using System.Text;
using Vyzio.Application.DTOs.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

public sealed class DiscoverCamerasUseCase(ICameraDiscoveryService discoveryService)
{
    public async Task<IReadOnlyList<DiscoveredCameraDto>> ExecuteAsync(CancellationToken ct = default)
    {
        var candidates = await discoveryService.DiscoverAsync(ct);
        return candidates.Select(DiscoveredCameraDto.From).ToList();
    }
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

        var baseSlug = Slugify(request.DisplayName);
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

    private static string Slugify(string value)
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

    private static string? NormalizeOptional(string? value)
        => CameraDraftFactory.NormalizeOptional(value);

    private static string? NormalizeStreamPath(string? value)
        => CameraDraftFactory.NormalizeStreamPath(value);

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

        var configPath = string.Empty;
        if (camera.IsEnabled || string.Equals(camera.ValidationState, "validated", StringComparison.OrdinalIgnoreCase))
        {
            var remaining = (await cameras.GetAllAsync(ct))
                .Where(existing => existing.Id != camera.Id)
                .Where(existing => string.Equals(existing.ValidationState, "validated", StringComparison.OrdinalIgnoreCase))
                .ToList();

            var applyResult = await frigateConfigApplier.ApplyAsync(remaining, ct);
            configPath = applyResult.ConfigPath;

            if (!applyResult.Applied)
            {
                return new DeleteCameraResultDto(false, applyResult.Message, configPath);
            }
        }

        await cameras.DeleteAsync(camera, ct);
        return new DeleteCameraResultDto(true, $"Camera \"{camera.DisplayName}\" deleted.", configPath);
    }
}

public sealed class ApplyCameraConfigurationUseCase(ICameraRepository cameras, IFrigateConfigApplier frigateConfigApplier)
{
    public async Task<ApplyCameraConfigurationResultDto> ExecuteAsync(CancellationToken ct = default)
    {
        var catalog = await cameras.GetAllAsync(ct);
        var applicable = catalog
            .Where(camera => string.Equals(camera.ValidationState, "validated", StringComparison.OrdinalIgnoreCase)
                || string.Equals(camera.Status, "online", StringComparison.OrdinalIgnoreCase))
            .DistinctBy(camera => camera.Id)
            .ToList();

        if (applicable.Count == 0)
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

        return new ApplyCameraConfigurationResultDto(
            true,
            applicable.Count == 1 ? "Configuration appliquee pour 1 camera." : $"Configuration appliquee pour {applicable.Count} cameras.",
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
            DetectionPreset = string.IsNullOrWhiteSpace(request.DetectionPreset) ? "person_default" : request.DetectionPreset.Trim(),
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
}