using Microsoft.Extensions.Logging;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

public sealed record CameraImageSettingsDto(int Brightness, int Contrast, int Saturation, int Sharpness, string IrCutMode)
{
    public static CameraImageSettingsDto From(CameraImageSettings settings) => new(
        settings.Brightness,
        settings.Contrast,
        settings.Saturation,
        settings.Sharpness,
        SnakeCaseEnum.ToSnakeCase(settings.IrCutMode));

    public CameraImageSettings ToEntity() => new(
        Brightness,
        Contrast,
        Saturation,
        Sharpness,
        SnakeCaseEnum.FromSnakeCase<Vyzio.Core.Entities.IrCutMode>(IrCutMode));
}

// Reads image settings live from the camera (ADR-27) — nothing persisted on the Vyzio side.
// Requires a configured AND verified ImageSettings binding; never offered on declaration alone.
public sealed class GetCameraImageSettingsUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry,
    ILogger<GetCameraImageSettingsUseCase> logger)
{
    public async Task<CameraImageSettingsDto?> ExecuteAsync(string cameraId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        var binding = await bindings.GetAsync(cameraId, CameraCapability.ImageSettings, ct);
        if (binding is null || !binding.Verified) return null;

        try
        {
            var settings = await registry.ResolveImageSettings(binding.Protocol).GetImageSettingsAsync(camera, binding, ct);
            return settings is null ? null : CameraImageSettingsDto.From(settings);
        }
        catch (Exception ex)
        {
            // No global exception middleware (API layer) — a transient camera failure here must
            // degrade to "unavailable" rather than surface as a raw 500. The verified probe result
            // in the capability row is where the real diagnostic (LastError) lives.
            logger.LogWarning(ex, "Failed to read live image settings for camera {CameraId}.", cameraId);
            return null;
        }
    }
}

// Writes image settings live to the camera, then re-reads to return the settings the camera
// actually applied (firmware may clamp/round values differently than requested).
public sealed class SetCameraImageSettingsUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry,
    ILogger<SetCameraImageSettingsUseCase> logger)
{
    public async Task<CameraImageSettingsDto?> ExecuteAsync(string cameraId, CameraImageSettingsDto request, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        var binding = await bindings.GetAsync(cameraId, CameraCapability.ImageSettings, ct);
        if (binding is null || !binding.Verified) return null;

        try
        {
            var provider = registry.ResolveImageSettings(binding.Protocol);
            await provider.SetImageSettingsAsync(camera, binding, request.ToEntity(), ct);

            var updated = await provider.GetImageSettingsAsync(camera, binding, ct);
            return updated is null ? null : CameraImageSettingsDto.From(updated);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to write live image settings for camera {CameraId}.", cameraId);
            return null;
        }
    }
}
