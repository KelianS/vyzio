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

public sealed class CreateCameraUseCase(ICameraRepository cameras)
{
    public async Task<CameraDto> ExecuteAsync(CreateCameraRequest request, CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(request.DisplayName);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.Host);

        var baseSlug = Slugify(request.DisplayName);
        var slug = await EnsureUniqueSlugAsync(baseSlug, ct);

        var camera = new Camera
        {
            Slug = slug,
            DisplayName = request.DisplayName.Trim(),
            Host = request.Host.Trim(),
            Port = request.Port > 0 ? request.Port : 554,
            Username = NormalizeOptional(request.Username),
            Password = NormalizeOptional(request.Password),
            StreamPath = NormalizeStreamPath(request.StreamPath),
            SourceType = string.IsNullOrWhiteSpace(request.SourceType) ? "rtsp_manual" : request.SourceType.Trim(),
            DetectionPreset = string.IsNullOrWhiteSpace(request.DetectionPreset) ? "person_default" : request.DetectionPreset.Trim(),
            Status = "needs_attention",
            ValidationState = "draft",
            IsEnabled = false,
            FrigateCameraName = slug.Replace('-', '_'),
            UpdatedAt = DateTimeOffset.UtcNow,
        };

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
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? NormalizeStreamPath(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        return trimmed.StartsWith('/') ? trimmed : $"/{trimmed}";
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