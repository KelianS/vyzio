using System.Text;
using Vyzio.Application.DTOs.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

public sealed class DiscoverCamerasUseCase(ICameraDiscoveryService discoveryService, ICameraRepository cameras)
{
    public async Task<IReadOnlyList<DiscoveredCameraDto>> ExecuteAsync(DiscoverCamerasRequest? request = null, CancellationToken ct = default)
    {
        var target = request?.ToTarget();
        var candidates = await discoveryService.DiscoverAsync(target, ct);
        var configuredEndpoints = (await cameras.GetAllAsync(ct))
            .Select(camera => BuildEndpointKey(camera.Host, camera.Port))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return candidates
            .Where(candidate => target is not null || !configuredEndpoints.Contains(BuildEndpointKey(candidate.Host, candidate.Port)))
            .Select(DiscoveredCameraDto.From)
            .ToList();
    }

    private static string BuildEndpointKey(string host, int port)
        => $"{host.Trim().ToLowerInvariant()}:{port}";
}

public sealed class GetVendorAssistanceUseCase(IVendorAssistanceService vendorAssistanceService)
{
    public async Task<VendorAssistanceDto?> ExecuteAsync(VendorAssistanceRequestDto request, CancellationToken ct = default)
    {
        var documentation = await vendorAssistanceService.GetAssistanceAsync(request.VendorFamily, request.StreamPath, request.Connected, ct);
        return VendorAssistanceDto.From(documentation);
    }
}

public sealed class CreateCameraUseCase(ICameraRepository cameras)
{
    public async Task<CameraDto> ExecuteAsync(CreateCameraRequest request, CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(request.DisplayName);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.Host);

        var baseSlug = CameraDraftFactory.Slugify(request.DisplayName);
        var slug = await EnsureUniqueSlugAsync(baseSlug, ct);

        var camera = BuildCameraDraft(request, slug);

        await cameras.AddAsync(camera, ct);
        return CameraDto.From(camera);
    }

    private async Task<string> EnsureUniqueSlugAsync(string baseSlug, CancellationToken ct)
    {
        var slug = baseSlug;
        var suffix = 2;

        while (await cameras.GetBySlugAsync(slug, ct) is not null)
        {
            slug = $"{baseSlug}-{suffix}";
            suffix++;
        }

        return slug;
    }

    internal static Camera BuildCameraDraft(CreateCameraRequest request, string slug)
        => CameraDraftFactory.Build(request, slug);


}

public sealed class VerifyDraftCameraUseCase(ICameraVerifier verifier)
{
    public async Task<CameraStatusDto> ExecuteAsync(CreateCameraRequest request, CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(request.DisplayName);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.Host);

        var camera = CameraDraftFactory.Build(request, "draft-camera");
        camera.Id = "draft-camera";

        var result = await verifier.VerifyAsync(camera, ct);
        camera.Status = result.Status;
        camera.LastReachabilityCheckAt = result.CheckedAt;
        camera.LastSuccessfulFrameAt = result.LastSuccessfulFrameAt;
        camera.UpdatedAt = DateTimeOffset.UtcNow;

        return CameraStatusDto.From(camera, result.Guidance);
    }
}

public sealed class VerifyCameraUseCase(ICameraRepository cameras, ICameraVerifier verifier)
{
    public async Task<CameraStatusDto?> ExecuteAsync(string id, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(id, ct);
        if (camera is null)
        {
            return null;
        }

        var result = await verifier.VerifyAsync(camera, ct);
        camera.Status = result.Status;
        camera.LastReachabilityCheckAt = result.CheckedAt;
        camera.LastSuccessfulFrameAt = result.LastSuccessfulFrameAt;
        camera.UpdatedAt = DateTimeOffset.UtcNow;

        await cameras.UpdateAsync(camera, ct);
        return CameraStatusDto.From(camera, result.Guidance);
    }
}

public sealed class UpdateCameraUseCase(ICameraRepository cameras, IFrigateConfigApplier frigateConfigApplier)
{
    public async Task<CameraDto?> ExecuteAsync(string id, UpdateCameraRequest request, CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(request.DisplayName);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.Host);

        var camera = await cameras.GetByIdAsync(id, ct);
        if (camera is null)
        {
            return null;
        }

        var normalizedHost = request.Host.Trim();
        var normalizedPort = request.Port > 0 ? request.Port : 554;
        var normalizedUsername = CameraDraftFactory.NormalizeOptional(request.Username);
        var normalizedStreamPath = CameraDraftFactory.NormalizeStreamPath(request.StreamPath);
        var normalizedVendorFamily = CameraDraftFactory.NormalizeOptional(request.VendorFamily);
        var normalizedSourceType = string.IsNullOrWhiteSpace(request.SourceType) ? camera.SourceType : request.SourceType.Trim();
        var normalizedStreamProtocol = string.IsNullOrWhiteSpace(request.StreamProtocol) ? camera.StreamProtocol : request.StreamProtocol.Trim().ToLowerInvariant();
        var normalizedPassword = request.Password is null ? null : CameraDraftFactory.NormalizeOptional(request.Password);

        var connectivityChanged = !string.Equals(camera.Host, normalizedHost, StringComparison.OrdinalIgnoreCase)
            || camera.Port != normalizedPort
            || !string.Equals(camera.Username, normalizedUsername, StringComparison.Ordinal)
            || !string.Equals(camera.StreamPath, normalizedStreamPath, StringComparison.Ordinal)
            || !string.Equals(camera.SourceType, normalizedSourceType, StringComparison.Ordinal)
            || !string.Equals(camera.VendorFamily, normalizedVendorFamily, StringComparison.Ordinal)
            || !string.Equals(camera.StreamProtocol, normalizedStreamProtocol, StringComparison.OrdinalIgnoreCase)
            || (normalizedPassword is not null && !string.Equals(camera.Password, normalizedPassword, StringComparison.Ordinal));

        var normalizedDisplayName = request.DisplayName.Trim();
        if (!string.Equals(camera.DisplayName, normalizedDisplayName, StringComparison.Ordinal))
        {
            camera.DisplayName = normalizedDisplayName;
            camera.FrigateCameraName = CameraDraftFactory.Slugify(normalizedDisplayName).Replace('-', '_');
        }

        camera.Host = normalizedHost;
        camera.Port = normalizedPort;
        camera.Username = normalizedUsername;
        camera.StreamPath = normalizedStreamPath;
        camera.SourceType = normalizedSourceType;
        camera.VendorFamily = normalizedVendorFamily;
        camera.StreamProtocol = normalizedStreamProtocol;

        if (normalizedPassword is not null)
        {
            camera.Password = normalizedPassword;
        }

        if (connectivityChanged)
        {
            camera.Status = "needs_attention";
            camera.ValidationState = "draft";
            camera.IsEnabled = false;
            camera.LastReachabilityCheckAt = null;
            camera.LastSuccessfulFrameAt = null;
        }

        camera.UpdatedAt = DateTimeOffset.UtcNow;

        await cameras.UpdateAsync(camera, ct);

        var catalog = await cameras.GetAllAsync(ct);
        var applicable = catalog
            .Where(c => c.IsEnabled && string.Equals(c.ValidationState, "validated", StringComparison.OrdinalIgnoreCase))
            .ToList();
        await frigateConfigApplier.WriteConfigAsync(applicable, ct);

        return CameraDto.From(camera);
    }
}

public sealed class ApplyCameraUseCase(ICameraRepository cameras, IFrigateConfigApplier frigateConfigApplier)
{
    public async Task<ApplyCameraResultDto?> ExecuteAsync(string id, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(id, ct);
        if (camera is null)
        {
            return null;
        }

        if (!string.Equals(camera.Status, "online", StringComparison.OrdinalIgnoreCase))
        {
            var status = CameraStatusDto.From(camera, "Verify the camera stream before applying the Frigate configuration.");
            return new ApplyCameraResultDto(false, "Camera verification is required before apply.", string.Empty, status);
        }

        camera.IsEnabled = true;
        camera.ValidationState = "validated";
        camera.FrigateCameraName ??= camera.Slug.Replace('-', '_');
        camera.UpdatedAt = DateTimeOffset.UtcNow;

        var catalog = await cameras.GetAllAsync(ct);
        var applicable = catalog
            .Where(existing => string.Equals(existing.ValidationState, "validated", StringComparison.OrdinalIgnoreCase))
            .Where(existing => existing.Id != camera.Id)
            .Append(camera)
            .ToList();

        var applyResult = await frigateConfigApplier.ApplyAsync(applicable, ct);

        if (!applyResult.Applied)
        {
            camera.Status = "config_error";
            camera.ValidationState = "draft";
            camera.IsEnabled = false;
            await cameras.UpdateAsync(camera, ct);

            return new ApplyCameraResultDto(
                false,
                applyResult.Message,
                applyResult.ConfigPath,
                CameraStatusDto.From(camera, applyResult.Message));
        }

        await cameras.UpdateAsync(camera, ct);
        return new ApplyCameraResultDto(
            true,
            applyResult.Message,
            applyResult.ConfigPath,
            CameraStatusDto.From(camera, "Camera configuration has been applied to Frigate."));
    }
}

public sealed class DeleteCameraUseCase(ICameraRepository cameras, IFrigateConfigApplier frigateConfigApplier)
{
    public async Task<DeleteCameraResultDto?> ExecuteAsync(string id, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(id, ct);
        if (camera is null)
        {
            return null;
        }

        camera.IsEnabled = false;
        camera.ValidationState = "pending_removal";
        camera.UpdatedAt = DateTimeOffset.UtcNow;

        await cameras.UpdateAsync(camera, ct);

        var catalog = await cameras.GetAllAsync(ct);
        var applicable = catalog
            .Where(c => c.IsEnabled && string.Equals(c.ValidationState, "validated", StringComparison.OrdinalIgnoreCase))
            .ToList();
        await frigateConfigApplier.WriteConfigAsync(applicable, ct);

        return new DeleteCameraResultDto(true, $"Camera \"{camera.DisplayName}\" queued for removal. Apply the configuration to update Frigate.", string.Empty);
    }
}

public sealed class ApplyCameraConfigurationUseCase(ICameraRepository cameras, IFrigateConfigApplier frigateConfigApplier)
{
    public async Task<ApplyCameraConfigurationResultDto> ExecuteAsync(CancellationToken ct = default)
    {
        var catalog = await cameras.GetAllAsync(ct);
        var pendingRemovals = catalog
            .Where(camera => string.Equals(camera.ValidationState, "pending_removal", StringComparison.OrdinalIgnoreCase))
            .ToList();

        var applicable = catalog
            .Where(camera => !string.Equals(camera.ValidationState, "pending_removal", StringComparison.OrdinalIgnoreCase))
            .Where(camera => string.Equals(camera.ValidationState, "validated", StringComparison.OrdinalIgnoreCase)
                || string.Equals(camera.Status, "online", StringComparison.OrdinalIgnoreCase))
            .DistinctBy(camera => camera.Id)
            .ToList();

        if (applicable.Count == 0 && pendingRemovals.Count == 0)
        {
            return new ApplyCameraConfigurationResultDto(false, "Aucune camera verifiee a appliquer pour le moment.", string.Empty, 0);
        }

        foreach (var camera in applicable)
        {
            camera.IsEnabled = true;
            camera.ValidationState = "validated";
            camera.FrigateCameraName ??= camera.Slug.Replace('-', '_');
            camera.UpdatedAt = DateTimeOffset.UtcNow;
        }

        var applyResult = await frigateConfigApplier.ApplyAsync(applicable, ct);
        if (!applyResult.Applied)
        {
            foreach (var camera in applicable)
            {
                camera.IsEnabled = false;
                camera.ValidationState = string.Equals(camera.Status, "online", StringComparison.OrdinalIgnoreCase) ? "draft" : camera.ValidationState;
                await cameras.UpdateAsync(camera, ct);
            }

            return new ApplyCameraConfigurationResultDto(
                false,
                string.IsNullOrWhiteSpace(applyResult.Message) ? "La configuration n'a pas pu etre appliquee." : applyResult.Message,
                applyResult.ConfigPath,
                applicable.Count);
        }

        foreach (var camera in applicable)
        {
            await cameras.UpdateAsync(camera, ct);
        }

        foreach (var removedCamera in pendingRemovals)
        {
            await cameras.DeleteAsync(removedCamera, ct);
        }

        return new ApplyCameraConfigurationResultDto(
            true,
            applicable.Count == 0
                ? "Configuration appliquee. Les suppressions en attente ont ete synchronisees."
                : applicable.Count == 1
                    ? "Configuration appliquee pour 1 camera."
                    : $"Configuration appliquee pour {applicable.Count} cameras.",
            applyResult.ConfigPath,
            applicable.Count);
    }
}

internal static class CameraDraftFactory
{
    public static Camera Build(CreateCameraRequest request, string slug)
        => new()
        {
            Slug = slug,
            DisplayName = request.DisplayName.Trim(),
            Host = request.Host.Trim(),
            Port = request.Port > 0 ? request.Port : 554,
            Username = NormalizeOptional(request.Username),
            Password = NormalizeOptional(request.Password),
            StreamPath = NormalizeStreamPath(request.StreamPath),
            VendorFamily = NormalizeOptional(request.VendorFamily),
            SourceType = string.IsNullOrWhiteSpace(request.SourceType) ? "rtsp_manual" : request.SourceType.Trim(),
            StreamProtocol = string.IsNullOrWhiteSpace(request.StreamProtocol) ? "rtsp" : request.StreamProtocol.Trim().ToLowerInvariant(),
            Status = "needs_attention",
            ValidationState = "draft",
            IsEnabled = false,
            FrigateCameraName = slug.Replace('-', '_'),
            UpdatedAt = DateTimeOffset.UtcNow,
        };

    public static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public static string? NormalizeStreamPath(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        return trimmed.StartsWith('/') ? trimmed : $"/{trimmed}";
    }

    public static string Slugify(string value)
    {
        var builder = new StringBuilder();
        var previousDash = false;

        foreach (var character in value.Trim().ToLowerInvariant())
        {
            if (char.IsLetterOrDigit(character))
            {
                builder.Append(character);
                previousDash = false;
                continue;
            }

            if (!previousDash)
            {
                builder.Append('-');
                previousDash = true;
            }
        }

        var slug = builder.ToString().Trim('-');
        return string.IsNullOrWhiteSpace(slug) ? "camera" : slug;
    }
}