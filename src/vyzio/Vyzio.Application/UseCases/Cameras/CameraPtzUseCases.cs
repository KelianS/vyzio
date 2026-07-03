using Vyzio.Application.DTOs.Cameras;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

public sealed record PtzMoveRequest(string Direction, int Speed = 50);

// Resolution is via the camera's verified Ptz binding + ICapabilityProviderRegistry (ADR-22)
// — never via VendorFamily/IVendorCameraAdapter. No binding, or a binding that hasn't been
// probed successfully, means PTZ is not offered — consistent with "never activate on
// declaration alone" (SPECS §2.3).
//
// Step: delegates to provider.PtzStepAsync which uses ONVIF RelativeMove when supported.
// RelativeMove sends a precise fraction of the pan/tilt range and the camera stops itself —
// no Stop command needed, no network-latency overshoot. Providers that don't support
// RelativeMove fall back to the default Move+Stop in IPtzCapabilityProvider.
public sealed class PtzStepUseCase(ICameraRepository cameras, ICameraCapabilityBindingRepository bindings, ICapabilityProviderRegistry registry)
{
    public async Task<bool> ExecuteAsync(string cameraId, PtzMoveRequest request, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return false;

        if (!Enum.TryParse<PtzDirection>(request.Direction, ignoreCase: true, out var direction))
            throw new ArgumentException($"Unknown PTZ direction '{request.Direction}'.");

        if (await bindings.GetAsync(cameraId, CameraCapability.Ptz, ct) is not { Verified: true } binding) return false;

        var provider = registry.ResolvePtz(binding.Protocol);
        await provider.PtzStepAsync(camera, binding, direction, Math.Clamp(request.Speed, 1, 100), ct);
        return true;
    }
}

public sealed class PtzSavePresetUseCase(ICameraRepository cameras, ICameraCapabilityBindingRepository bindings, ICapabilityProviderRegistry registry)
{
    public async Task<bool> ExecuteAsync(string cameraId, int presetId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return false;

        if (await bindings.GetAsync(cameraId, CameraCapability.Ptz, ct) is not { Verified: true } binding) return false;

        var provider = registry.ResolvePtz(binding.Protocol);
        await provider.PtzSavePresetAsync(camera, binding, presetId, ct);
        return true;
    }
}

public sealed class PtzGoToPresetUseCase(ICameraRepository cameras, ICameraCapabilityBindingRepository bindings, ICapabilityProviderRegistry registry)
{
    public async Task<bool> ExecuteAsync(string cameraId, int presetId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return false;

        if (await bindings.GetAsync(cameraId, CameraCapability.Ptz, ct) is not { Verified: true } binding) return false;

        var provider = registry.ResolvePtz(binding.Protocol);
        await provider.PtzGoToPresetAsync(camera, binding, presetId, ct);
        return true;
    }
}

// Saves the current camera position as the surveillance home preset (preset ID 1).
// Called from the fiche caméra when the user clicks "Définir position de surveillance".
public sealed class ConfigurePtzParkingPositionUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry)
{
    public async Task<bool> ExecuteAsync(string cameraId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return false;

        if (await bindings.GetAsync(cameraId, CameraCapability.Ptz, ct) is not { Verified: true } binding) return false;

        var provider = registry.ResolvePtz(binding.Protocol);
        // Preset 1 = surveillance/home position by convention.
        await provider.PtzSavePresetAsync(camera, binding, presetId: 1, ct);
        return true;
    }
}

// Diagnostic only — checks if camera reports its current pan/tilt position via ONVIF GetStatus.
// Used to verify GetStatus support before implementing AbsoluteMove-based home positioning.
public sealed class GetPtzPositionUseCase(ICameraRepository cameras, ICameraCapabilityBindingRepository bindings, ICapabilityProviderRegistry registry)
{
    public async Task<(float Pan, float Tilt)?> ExecuteAsync(string cameraId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        if (await bindings.GetAsync(cameraId, CameraCapability.Ptz, ct) is not { Verified: true } binding) return null;

        var provider = registry.ResolvePtz(binding.Protocol);
        return await provider.GetPtzPositionAsync(camera, binding, ct);
    }
}

public sealed record SetPrivacyStrategyRequest(string Strategy);

public sealed class SetCameraPrivacyStrategyUseCase(ICameraRepository cameras)
{
    public async Task<CameraDto?> ExecuteAsync(string cameraId, SetPrivacyStrategyRequest request, CancellationToken ct = default)
    {
        if (!SnakeCaseEnum.TryFromSnakeCase<PrivacyModeStrategy>(request.Strategy, out var strategy))
            throw new ArgumentException($"Invalid privacy strategy '{request.Strategy}'. Valid values: software, ptz_parking, hardware.");

        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        camera.PrivacyModeStrategy = strategy;
        camera.UpdatedAt = DateTimeOffset.UtcNow;
        await cameras.UpdateAsync(camera, ct);

        return CameraDto.From(camera);
    }
}
