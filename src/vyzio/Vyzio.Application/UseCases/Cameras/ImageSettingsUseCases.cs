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
    ICapabilityProviderRegistry registry)
{
    public async Task<CameraImageSettingsDto?> ExecuteAsync(string cameraId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        var binding = await bindings.GetAsync(cameraId, CameraCapability.ImageSettings, ct);
        if (binding is null || !binding.Verified) return null;

        var settings = await registry.ResolveImageSettings(binding.Protocol).GetImageSettingsAsync(camera, binding, ct);
        return settings is null ? null : CameraImageSettingsDto.From(settings);
    }
}

// Writes image settings live to the camera, then re-reads to return the settings the camera
// actually applied (firmware may clamp/round values differently than requested).
public sealed class SetCameraImageSettingsUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry)
{
    public async Task<CameraImageSettingsDto?> ExecuteAsync(string cameraId, CameraImageSettingsDto request, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        var binding = await bindings.GetAsync(cameraId, CameraCapability.ImageSettings, ct);
        if (binding is null || !binding.Verified) return null;

        var provider = registry.ResolveImageSettings(binding.Protocol);
        await provider.SetImageSettingsAsync(camera, binding, request.ToEntity(), ct);

        var updated = await provider.GetImageSettingsAsync(camera, binding, ct);
        return updated is null ? null : CameraImageSettingsDto.From(updated);
    }
}
