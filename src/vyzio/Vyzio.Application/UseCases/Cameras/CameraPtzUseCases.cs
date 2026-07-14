using System.Text.Json;
using Vyzio.Application.DTOs.Cameras;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

public sealed record PtzMoveRequest(string Direction, int Speed = 50);

// Thrown by PtzSavePresetUseCase / ConfigurePtzParkingPositionUseCase when Branch B position
// tracking has not been calibrated (PtzCalibrateUseCase not yet called this session).
public sealed class PtzNotCalibratedException : InvalidOperationException
{
    public PtzNotCalibratedException()
        : base("PTZ position not calibrated. Call POST /ptz/calibrate first to establish reference.") { }
}

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

public sealed class PtzSavePresetUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry,
    IPtzPresetRepository presets)
{
    public async Task<bool> ExecuteAsync(string cameraId, int presetId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return false;

        if (await bindings.GetAsync(cameraId, CameraCapability.Ptz, ct) is not { Verified: true } binding) return false;

        var provider = registry.ResolvePtz(binding.Protocol);

        if (PtzPresetHelper.SupportsNativePresets(binding.ConfigJson))
        {
            await provider.PtzSavePresetAsync(camera, binding, presetId, ct);
        }
        else
        {
            // Branch B (ADR-25): position must be calibrated before saving (call PtzCalibrateUseCase first).
            // Auto-homing here would destroy the user's current position and save (0,0) instead.
            if (provider.GetVirtualPosition(cameraId) is not { } pos)
                throw new PtzNotCalibratedException();

            await presets.UpsertAsync(new PtzPreset
            {
                CameraId = cameraId,
                PresetId = presetId,
                Label = PtzPreset.DefaultLabel(presetId),
                Native = false,
                StepsX = pos.StepsX,
                StepsY = pos.StepsY,
            }, ct);
        }

        return true;
    }
}

public sealed class PtzGoToPresetUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry,
    IPtzPresetRepository presets)
{
    public async Task<bool> ExecuteAsync(string cameraId, int presetId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return false;

        if (await bindings.GetAsync(cameraId, CameraCapability.Ptz, ct) is not { Verified: true } binding) return false;

        var provider = registry.ResolvePtz(binding.Protocol);

        if (PtzPresetHelper.SupportsNativePresets(binding.ConfigJson))
        {
            await provider.PtzGoToPresetAsync(camera, binding, presetId, ct);
        }
        else
        {
            // Branch B (ADR-25): go directly using the delta from current virtual position when known.
            // Homing is only needed when position is unknown (restart before calibration).
            var preset = await presets.GetAsync(cameraId, presetId, ct);
            if (preset is null) return false;

            var targetX = preset.StepsX ?? 0;
            var targetY = preset.StepsY ?? 0;

            if (provider.GetVirtualPosition(cameraId) is { } current)
            {
                var dx = targetX - current.StepsX;
                var dy = targetY - current.StepsY;

                var dirX = dx > 0 ? PtzDirection.Right : PtzDirection.Left;
                for (var i = 0; i < Math.Abs(dx); i++)
                    await provider.PtzStepAsync(camera, binding, dirX, 50, ct);

                var dirY = dy > 0 ? PtzDirection.Down : PtzDirection.Up;
                for (var i = 0; i < Math.Abs(dy); i++)
                    await provider.PtzStepAsync(camera, binding, dirY, 50, ct);
            }
            else
            {
                // Position unknown: home to (0,0) then replay to target.
                await provider.PtzHomingStepsAsync(camera, binding, ct);
                for (var i = 0; i < targetX; i++)
                    await provider.PtzStepAsync(camera, binding, PtzDirection.Right, 50, ct);
                for (var i = 0; i < targetY; i++)
                    await provider.PtzStepAsync(camera, binding, PtzDirection.Down, 50, ct);
            }
        }

        return true;
    }
}

// Saves the current camera position as the surveillance home preset (preset ID 1).
// Called from the fiche caméra when the user clicks "Définir position de surveillance".
public sealed class ConfigurePtzParkingPositionUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry,
    IPtzPresetRepository presets)
{
    public async Task<bool> ExecuteAsync(string cameraId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return false;

        if (await bindings.GetAsync(cameraId, CameraCapability.Ptz, ct) is not { Verified: true } binding) return false;

        var provider = registry.ResolvePtz(binding.Protocol);

        if (PtzPresetHelper.SupportsNativePresets(binding.ConfigJson))
        {
            // Preset 1 = surveillance/home position by convention.
            await provider.PtzSavePresetAsync(camera, binding, presetId: 1, ct);
        }
        else
        {
            if (provider.GetVirtualPosition(cameraId) is not { } pos)
                throw new PtzNotCalibratedException();

            await presets.UpsertAsync(new PtzPreset
            {
                CameraId = cameraId,
                PresetId = 1,
                Label = PtzPreset.DefaultLabel(1),
                Native = false,
                StepsX = pos.StepsX,
                StepsY = pos.StepsY,
            }, ct);
        }

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

// Returns all configured PTZ presets for a camera, plus calibration state and current position (ADR-25).
public sealed class GetPtzPresetsUseCase(
    IPtzPresetRepository presets,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry)
{
    public async Task<(IReadOnlyList<PtzPreset> Presets, bool Calibrated, (int X, int Y)? Position)> ExecuteAsync(string cameraId, CancellationToken ct = default)
    {
        var list = await presets.GetAllAsync(cameraId, ct);
        var binding = await bindings.GetAsync(cameraId, CameraCapability.Ptz, ct);
        if (binding is not { Verified: true })
            return (list, true, null);

        if (PtzPresetHelper.SupportsNativePresets(binding.ConfigJson))
            return (list, true, null);

        var pos = registry.ResolvePtz(binding.Protocol).GetVirtualPosition(cameraId);
        return (list, pos is not null, pos is { } p ? (p.StepsX, p.StepsY) : null);
    }
}

// Branch B calibration: sends homing steps to establish the (0,0) reference position (ADR-25).
// Must be called before PtzSavePresetUseCase when SupportsNativePresets is false.
public sealed class PtzCalibrateUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry)
{
    public async Task<bool> ExecuteAsync(string cameraId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return false;

        if (await bindings.GetAsync(cameraId, CameraCapability.Ptz, ct) is not { Verified: true } binding) return false;

        if (PtzPresetHelper.SupportsNativePresets(binding.ConfigJson)) return true; // nothing to do

        var provider = registry.ResolvePtz(binding.Protocol);
        await provider.PtzHomingStepsAsync(camera, binding, ct);
        return true;
    }
}

public sealed record SetPrivacyStrategyRequest(string Strategy);

public sealed class SetCameraPrivacyStrategyUseCase(ICameraRepository cameras)
{
    public async Task<CameraDto?> ExecuteAsync(string cameraId, SetPrivacyStrategyRequest request, CancellationToken ct = default)
    {
        if (!SnakeCaseEnum.TryFromSnakeCase<PrivacyStrategy>(request.Strategy, out var strategy))
            throw new ArgumentException($"Invalid privacy strategy '{request.Strategy}'. Valid values: none, software_blur, ptz_parking, hardware.");

        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        camera.PrivacyStrategy = strategy;
        camera.UpdatedAt = DateTimeOffset.UtcNow;
        await cameras.UpdateAsync(camera, ct);

        return CameraDto.From(camera);
    }
}

// Shared helper: reads SupportsNativePresets from binding ConfigJson (ADR-25).
file static class PtzPresetHelper
{
    internal static bool SupportsNativePresets(string? configJson)
    {
        if (string.IsNullOrEmpty(configJson)) return false;
        try
        {
            using var doc = JsonDocument.Parse(configJson);
            return doc.RootElement.TryGetProperty("supports_native_presets", out var prop) && prop.GetBoolean();
        }
        catch { return false; }
    }
}
