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

// Thrown when Vyzio keeps the positions and the camera has not been homed since the service started (ADR-59).
public sealed class PtzNotCalibratedException : InvalidOperationException
{
    public PtzNotCalibratedException()
        : base("PTZ position not calibrated. Call POST /ptz/calibrate first to establish reference.") { }
}

// Resolved through the camera's verified Ptz binding, never the brand (ADR-22); every move is counted (ADR-59, ADR-60).
internal static class PtzJoystick
{
    // Null when the camera is unknown or its PTZ unverified; the direction is the one the user pressed (SPECS 11).
    public static async Task<(Camera Camera, CameraCapabilityBinding Binding, IPtzCapabilityProvider Provider, PtzDirection Pressed)?> ResolveAsync(
        ICameraRepository cameras, ICameraCapabilityBindingRepository bindings, ICapabilityProviderRegistry registry,
        string cameraId, string requestedDirection, CancellationToken ct)
    {
        if (await cameras.GetByIdAsync(cameraId, ct) is not { } camera) return null;

        if (!Enum.TryParse<PtzDirection>(requestedDirection, ignoreCase: true, out var direction))
            throw new ArgumentException($"Unknown PTZ direction '{requestedDirection}'.");

        if (await bindings.GetAsync(cameraId, CameraCapability.Ptz, ct) is not { Verified: true } binding) return null;

        var pressed = PtzPanDirection.AsPressed(direction, PtzPanDirection.IsInverted(binding.ConfigJson));
        return (camera, binding, registry.ResolvePtz(binding.Protocol), pressed);
    }
}

// A tap: a timed move of a fixed duration (ADR-60).
public sealed class PtzStepUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry,
    PtzManagedPositions positions)
{
    public async Task<bool> ExecuteAsync(string cameraId, PtzMoveRequest request, CancellationToken ct = default)
    {
        if (await PtzJoystick.ResolveAsync(cameras, bindings, registry, cameraId, request.Direction, ct) is not { } ptz) return false;

        await positions.TapAsync(ptz.Camera, ptz.Binding, ptz.Provider, ptz.Pressed, Math.Clamp(request.Speed, 1, 100), ct);
        return true;
    }
}

// A press held past a tap: one move until released (ADR-60).
public sealed class PtzStartMoveUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry,
    PtzManagedPositions positions)
{
    public async Task<bool> ExecuteAsync(string cameraId, PtzMoveRequest request, CancellationToken ct = default)
    {
        if (await PtzJoystick.ResolveAsync(cameras, bindings, registry, cameraId, request.Direction, ct) is not { } ptz) return false;

        await positions.StartHoldAsync(ptz.Camera, ptz.Binding, ptz.Provider, ptz.Pressed, Math.Clamp(request.Speed, 1, 100), ct);
        return true;
    }
}

// The interface says the press still lasts; false when no move is held any more (ADR-60).
public sealed class PtzSignalMoveUseCase(PtzManagedPositions positions)
{
    public bool Execute(string cameraId) => positions.SignalHold(cameraId);
}

// The release of a held press; nothing to do when the move already stopped.
public sealed class PtzStopMoveUseCase(PtzManagedPositions positions)
{
    public Task ExecuteAsync(string cameraId) => positions.StopHoldAsync(cameraId);
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
    IPtzPresetRepository presets,
    PtzManagedPositions positions)
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
            // Homing here would throw away the framing the user just aimed at (ADR-46).
            if (positions.Current(cameraId) is not { } pos)
                throw new PtzNotCalibratedException();

            await presets.UpsertAsync(new PtzPreset
            {
                CameraId = cameraId,
                PresetId = presetId,
                Label = PtzPreset.DefaultLabel(presetId),
                Native = false,
                PanMs = pos.X,
                TiltMs = pos.Y,
            }, ct);
        }

        return true;
    }
}

public sealed class PtzGoToPresetUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry,
    IPtzPresetRepository presets,
    PtzManagedPositions positions)
{
    public async Task<bool> ExecuteAsync(string cameraId, int presetId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return false;

        if (await bindings.GetAsync(cameraId, CameraCapability.Ptz, ct) is not { Verified: true } binding) return false;

        return await PtzPresetMove.GoToAsync(camera, binding, registry.ResolvePtz(binding.Protocol), positions, presets, presetId, ct);
    }
}

// One way to reach a saved position, whether the camera keeps it or Vyzio does (ADR-57, ADR-59).
internal static class PtzPresetMove
{
    // False when Vyzio keeps the positions and this one was never saved.
    public static async Task<bool> GoToAsync(
        Camera camera,
        CameraCapabilityBinding binding,
        IPtzCapabilityProvider provider,
        PtzManagedPositions positions,
        IPtzPresetRepository presets,
        int presetId,
        CancellationToken ct)
    {
        if (BindingConfig.ReadBool(binding.ConfigJson, BindingConfig.SupportsNativePresets))
        {
            await provider.PtzGoToPresetAsync(camera, binding, presetId, ct);
            return true;
        }

        if (await presets.GetAsync(camera.Id, presetId, ct) is not { } preset) return false;

        await positions.GoToAsync(camera, binding, provider, preset.PanMs ?? 0, preset.TiltMs ?? 0, ct);
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

// Returns all configured PTZ presets for a camera, plus calibration state and current position (ADR-59).
public sealed class GetPtzPresetsUseCase(
    IPtzPresetRepository presets,
    ICameraCapabilityBindingRepository bindings,
    PtzManagedPositions positions)
{
    public async Task<(IReadOnlyList<PtzPreset> Presets, bool Calibrated, (int X, int Y)? Position)> ExecuteAsync(string cameraId, CancellationToken ct = default)
    {
        var list = await presets.GetAllAsync(cameraId, ct);
        var binding = await bindings.GetAsync(cameraId, CameraCapability.Ptz, ct);
        if (binding is not { Verified: true })
            return (list, true, null);

        if (BindingConfig.ReadBool(binding.ConfigJson, BindingConfig.SupportsNativePresets))
            return (list, true, null);

        var pos = positions.Current(cameraId);
        return (list, pos is not null, pos);
    }
}

// Homes a camera whose positions Vyzio keeps; never claims a calibration the camera did not do (ADR-59).
public sealed class PtzCalibrateUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry,
    PtzManagedPositions positions)
{
    public async Task<bool> ExecuteAsync(string cameraId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return false;

        if (await bindings.GetAsync(cameraId, CameraCapability.Ptz, ct) is not { Verified: true } binding) return false;

        if (BindingConfig.ReadBool(binding.ConfigJson, BindingConfig.SupportsNativePresets)) return true; // nothing to do

        await positions.HomeAsync(camera, binding, registry.ResolvePtz(binding.Protocol), ct);
        return true;
    }
}

public sealed record SetPrivacyStrategyRequest(string Strategy);

public sealed class SetCameraPrivacyStrategyUseCase(ICameraRepository cameras, IPtzPresetRepository presets)
{
    public async Task<CameraDto?> ExecuteAsync(string cameraId, SetPrivacyStrategyRequest request, CancellationToken ct = default)
    {
        if (!SnakeCaseEnum.TryFromSnakeCase<PrivacyStrategy>(request.Strategy, out var strategy))
            throw new ArgumentException($"Invalid privacy strategy '{request.Strategy}'. Valid values: software_blur, ptz_parking, hardware.");

        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        // Parking promises a move there and back; both ends must be saved (ADR-57).
        if (strategy == PrivacyStrategy.PtzParking
            && camera.PrivacyStrategy != PrivacyStrategy.PtzParking
            && (await presets.GetAsync(cameraId, PtzPreset.ParkingSlot, ct) is null
                || await presets.GetAsync(cameraId, PtzPreset.SurveillanceSlot, ct) is null))
            throw new ParkingPositionsMissingException();

        // The last toggle's miss described the old strategy and would misname the new one (SPECS 9.2).
        if (camera.PrivacyStrategy != strategy)
        {
            camera.PrivacyMiss = null;
            camera.PrivacyMissDetail = null;
        }
        camera.PrivacyStrategy = strategy;
        camera.UpdatedAt = DateTimeOffset.UtcNow;
        await cameras.UpdateAsync(camera, ct);

        return CameraDto.From(camera);
    }
}
