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

// A press of the joystick: one move from the press to the release, resolved through the camera's verified Ptz binding, never the brand (ADR-22, ADR-60).
public sealed class PtzStartMoveUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry,
    PtzManagedPositions positions)
{
    public Task<bool> ExecuteAsync(string cameraId, PtzMoveRequest request, CancellationToken ct = default)
        => positions.StartHoldAsync(cameraId, () => ResolveAsync(cameraId, request, ct), ct);

    // Null when the camera is unknown or its PTZ unverified; the direction is the one the user pressed (SPECS 11).
    private async Task<PtzPress?> ResolveAsync(string cameraId, PtzMoveRequest request, CancellationToken ct)
    {
        if (await cameras.GetByIdAsync(cameraId, ct) is not { } camera) return null;

        if (!Enum.TryParse<PtzDirection>(request.Direction, ignoreCase: true, out var direction))
            throw new ArgumentException($"Unknown PTZ direction '{request.Direction}'.");

        if (await bindings.GetAsync(cameraId, CameraCapability.Ptz, ct) is not { Verified: true } binding) return null;

        var pressed = PtzPanDirection.AsPressed(direction, PtzPanDirection.IsInverted(binding.ConfigJson));
        return new PtzPress(camera, binding, registry.ResolvePtz(binding.Protocol), pressed, Math.Clamp(request.Speed, 1, 100));
    }
}

// The interface says the press still lasts; false when no move is held any more (ADR-60).
public sealed class PtzSignalMoveUseCase(PtzManagedPositions positions)
{
    public bool Execute(string cameraId) => positions.SignalHold(cameraId);
}

// The release of a press; nothing to do when the move already stopped.
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

// Saves the current view on a slot: the camera stores it as its preset of that number, or Vyzio counts it (ADR-60, ADR-69).
public sealed class PtzSavePresetUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry,
    IPtzPresetRepository presets,
    IPtzThumbnailStore thumbnails,
    PtzManagedPositions positions)
{
    public async Task<bool> ExecuteAsync(string cameraId, int presetId, CancellationToken ct = default)
    {
        if (!PtzPreset.IsSlot(presetId)) return false;

        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return false;

        if (await bindings.GetAsync(cameraId, CameraCapability.Ptz, ct) is not { Verified: true } binding) return false;

        if (PtzPositionTier.IsNative(binding))
        {
            // The camera alone records that the slot is held (ADR-69 a).
            await registry.ResolvePtz(binding.Protocol).PtzSavePresetAsync(camera, binding, presetId, ct);
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
                PanMs = pos.X,
                TiltMs = pos.Y,
            }, ct);
        }

        // The old thumbnail showed another view: the slot reads held without one until the next capture (ADR-69 d).
        await thumbnails.DeleteAsync(cameraId, presetId, ct);
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
    // False when the slot holds no position on the camera's current tier (ADR-64, ADR-69).
    public static async Task<bool> GoToAsync(
        Camera camera,
        CameraCapabilityBinding binding,
        IPtzCapabilityProvider provider,
        PtzManagedPositions positions,
        IPtzPresetRepository presets,
        int presetId,
        CancellationToken ct)
    {
        if (PtzPositionTier.IsNative(binding))
        {
            if (!(await provider.ReadPresetsAsync(camera, binding, ct)).Contains(presetId)) return false;
            await provider.PtzGoToPresetAsync(camera, binding, presetId, ct);
            return true;
        }

        if (await presets.GetAsync(camera.Id, presetId, ct) is not { } preset) return false;
        await positions.GoToAsync(camera, binding, provider, preset.PanMs ?? 0, preset.TiltMs ?? 0, ct);
        return true;
    }
}

// Which tier keeps the camera's positions: the camera itself once its probe found it can, Vyzio otherwise (ADR-59, ADR-69).
internal static class PtzPositionTier
{
    public static bool IsNative(CameraCapabilityBinding binding)
        => BindingConfig.ReadBool(binding.ConfigJson, BindingConfig.SupportsNativePresets);
}

// The slots that hold a position: the camera's presets of those numbers on the native tier, Vyzio's rows otherwise (ADR-69 a, g).
internal static class PtzHeldSlots
{
    public static bool ReadFromTheCamera(CameraCapabilityBinding? binding) => binding is not null && PtzPositionTier.IsNative(binding);

    public static async Task<IReadOnlySet<int>> ReadAsync(
        Camera camera, CameraCapabilityBinding? binding, ICapabilityProviderRegistry registry, IReadOnlyList<PtzPreset> rows, CancellationToken ct)
    {
        var held = ReadFromTheCamera(binding)
            ? await registry.ResolvePtz(binding!.Protocol).ReadPresetsAsync(camera, binding, ct)
            : rows.Select(preset => preset.PresetId).ToHashSet();
        return held.Where(PtzPreset.IsSlot).ToHashSet();
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

// A slot that holds a position, with what Vyzio keeps of it: its label, whether its thumbnail was taken, and its motion time when Vyzio counts it (ADR-69 c).
public sealed record PtzHeldSlot(int PresetId, string Label, bool Thumbnail, int? PanMs = null, int? TiltMs = null);

public sealed record PtzSlots(IReadOnlyList<PtzHeldSlot> Held, bool Calibrated, (int X, int Y)? Position);

// The slots that hold a position, read from the camera on the native tier, plus calibration state and current position (ADR-59, ADR-69).
public sealed class GetPtzPresetsUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry,
    IPtzPresetRepository presets,
    IPtzThumbnailStore thumbnails,
    PtzManagedPositions positions)
{
    // Raises a CameraCommandException when the camera cannot say which slots it holds, never reads them empty (ADR-69 g).
    public async Task<PtzSlots> ExecuteAsync(string cameraId, CancellationToken ct = default)
    {
        var rows = await presets.GetAllAsync(cameraId, ct);
        if (await cameras.GetByIdAsync(cameraId, ct) is not { } camera) return new PtzSlots([], Calibrated: true, Position: null);
        // An unverified PTZ moves nothing: its rows are listed, the camera is not asked (ADR-59).
        var binding = await bindings.GetAsync(cameraId, CameraCapability.Ptz, ct) is { Verified: true } verified ? verified : null;
        var native = PtzHeldSlots.ReadFromTheCamera(binding);
        var held = await PtzHeldSlots.ReadAsync(camera, binding, registry, rows, ct);

        var slots = new List<PtzHeldSlot>();
        foreach (var slot in PtzPreset.Slots)
        {
            if (!held.Contains(slot))
            {
                // A slot read empty drops its thumbnail, so it never shows over another view saved there later (ADR-69 c).
                if (native) await thumbnails.DeleteAsync(cameraId, slot, ct);
                continue;
            }

            var row = rows.FirstOrDefault(preset => preset.PresetId == slot);
            slots.Add(new PtzHeldSlot(
                slot,
                row?.Label is { Length: > 0 } label ? label : PtzPreset.DefaultLabel(slot),
                await thumbnails.ExistsAsync(cameraId, slot, ct),
                native ? null : row?.PanMs,
                native ? null : row?.TiltMs));
        }

        // Nothing to calibrate where the camera keeps the positions, or where PTZ moves nothing yet (ADR-59).
        if (native || binding is null) return new PtzSlots(slots, Calibrated: true, Position: null);

        var pos = positions.Current(cameraId);
        return new PtzSlots(slots, pos is not null, pos);
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

        if (PtzPositionTier.IsNative(binding)) return true; // nothing to do

        await positions.HomeAsync(camera, binding, registry.ResolvePtz(binding.Protocol), ct);
        return true;
    }
}

public sealed record SetPrivacyStrategyRequest(string Strategy);

public sealed class SetCameraPrivacyStrategyUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry,
    IPtzPresetRepository presets)
{
    public async Task<CameraDto?> ExecuteAsync(string cameraId, SetPrivacyStrategyRequest request, CancellationToken ct = default)
    {
        if (!SnakeCaseEnum.TryFromSnakeCase<PrivacyStrategy>(request.Strategy, out var strategy))
            throw new ArgumentException($"Invalid privacy strategy '{request.Strategy}'. Valid values: software_blur, ptz_parking, hardware.");

        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        // Parking promises a move there and back; both ends must be held, on the tier the camera is on (ADR-57, ADR-69).
        if (strategy == PrivacyStrategy.PtzParking
            && camera.PrivacyStrategy != PrivacyStrategy.PtzParking
            && !await BothEndsHeldAsync(camera, ct))
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

    // A camera that cannot say which slots it holds raises it: choosing parking waits for a read (ADR-69 g).
    private async Task<bool> BothEndsHeldAsync(Camera camera, CancellationToken ct)
    {
        var binding = await bindings.GetAsync(camera.Id, CameraCapability.Ptz, ct);
        var held = await PtzHeldSlots.ReadAsync(camera, binding, registry, await presets.GetAllAsync(camera.Id, ct), ct);
        return held.Contains(PtzPreset.ParkingSlot) && held.Contains(PtzPreset.SurveillanceSlot);
    }
}
