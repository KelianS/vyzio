using System.Globalization;
using Vyzio.Application.DTOs.Cameras;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

public sealed record PtzMoveRequest(string Direction, int Speed = 50);

// Thrown when ptz_parking is chosen before both of its positions are saved (ADR-57).
public sealed class ParkingPositionsMissingException : InvalidOperationException
{
    public ParkingPositionsMissingException()
        : base("Save the camera's Surveillance (preset 1) and Parking (preset 2) positions before choosing ptz_parking.") { }
}

// Thrown by PtzSavePresetUseCase when Branch B position tracking has not been calibrated
// (PtzCalibrateUseCase not yet called this session).
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
        var pressed = PtzPanDirection.AsPressed(direction, PtzPanDirection.IsInverted(binding.ConfigJson));
        await provider.PtzStepAsync(camera, binding, pressed, Math.Clamp(request.Speed, 1, 100), ct);
        return true;
    }
}

// Sets whether left and right are swapped for a camera that turns the other way (SPECS 11).
public sealed class SetPtzPanInvertedUseCase(ICameraCapabilityBindingRepository bindings)
{
    public async Task<CameraCapabilityBindingDto?> ExecuteAsync(string cameraId, bool inverted, CancellationToken ct = default)
    {
        if (await bindings.GetAsync(cameraId, CameraCapability.Ptz, ct) is not { } binding) return null;

        binding.ConfigJson = BindingConfig.With(binding.ConfigJson, BindingConfig.PanInverted, inverted);
        await bindings.SaveAsync(binding, ct);
        return CameraCapabilityBindingDto.From(binding);
    }
}

// The swap happens where the user presses, never in a provider: saved positions replay in the camera's own frame.
internal static class PtzPanDirection
{
    public static bool IsInverted(string? configJson) => BindingConfig.ReadBool(configJson, BindingConfig.PanInverted);

    public static PtzDirection AsPressed(PtzDirection direction, bool inverted) => !inverted ? direction : direction switch
    {
        PtzDirection.Left => PtzDirection.Right,
        PtzDirection.Right => PtzDirection.Left,
        PtzDirection.UpLeft => PtzDirection.UpRight,
        PtzDirection.UpRight => PtzDirection.UpLeft,
        PtzDirection.DownLeft => PtzDirection.DownRight,
        PtzDirection.DownRight => PtzDirection.DownLeft,
        _ => direction,
    };
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

        if (BindingConfig.ReadBool(binding.ConfigJson, BindingConfig.SupportsNativePresets))
        {
            await provider.PtzSavePresetAsync(camera, binding, presetId, ct);
            // Held by the camera under the slot's token; the row lets Vyzio know the slot is saved (ADR-57).
            await presets.UpsertAsync(new PtzPreset
            {
                CameraId = cameraId,
                PresetId = presetId,
                Label = PtzPreset.DefaultLabel(presetId),
                Native = true,
                NativeToken = presetId.ToString(CultureInfo.InvariantCulture),
            }, ct);
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

        return await PtzPresetMove.GoToAsync(camera, binding, registry.ResolvePtz(binding.Protocol), presets, presetId, ct);
    }
}

// One way to reach a saved position, whether the camera keeps it or Vyzio does (ADR-25).
internal static class PtzPresetMove
{
    // False when Vyzio keeps the positions and this one was never saved.
    public static async Task<bool> GoToAsync(
        Camera camera,
        CameraCapabilityBinding binding,
        IPtzCapabilityProvider provider,
        IPtzPresetRepository presets,
        int presetId,
        CancellationToken ct)
    {
        var cameraId = camera.Id;
        if (BindingConfig.ReadBool(binding.ConfigJson, BindingConfig.SupportsNativePresets))
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

        if (BindingConfig.ReadBool(binding.ConfigJson, BindingConfig.SupportsNativePresets))
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

        if (BindingConfig.ReadBool(binding.ConfigJson, BindingConfig.SupportsNativePresets)) return true; // nothing to do

        var provider = registry.ResolvePtz(binding.Protocol);
        await provider.PtzHomingStepsAsync(camera, binding, ct);
        return true;
    }
}

public sealed record SetPrivacyStrategyRequest(string Strategy);

public sealed class SetCameraPrivacyStrategyUseCase(ICameraRepository cameras, IPtzPresetRepository presets)
{
    public async Task<CameraDto?> ExecuteAsync(string cameraId, SetPrivacyStrategyRequest request, CancellationToken ct = default)
    {
        if (!SnakeCaseEnum.TryFromSnakeCase<PrivacyStrategy>(request.Strategy, out var strategy))
            throw new ArgumentException($"Invalid privacy strategy '{request.Strategy}'. Valid values: none, software_blur, ptz_parking, hardware.");

        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        // Parking promises a move there and back; both ends must be saved (ADR-57).
        if (strategy == PrivacyStrategy.PtzParking
            && camera.PrivacyStrategy != PrivacyStrategy.PtzParking
            && (await presets.GetAsync(cameraId, PtzPreset.ParkingSlot, ct) is null
                || await presets.GetAsync(cameraId, PtzPreset.SurveillanceSlot, ct) is null))
            throw new ParkingPositionsMissingException();

        camera.PrivacyStrategy = strategy;
        camera.UpdatedAt = DateTimeOffset.UtcNow;
        await cameras.UpdateAsync(camera, ct);

        return CameraDto.From(camera);
    }
}
