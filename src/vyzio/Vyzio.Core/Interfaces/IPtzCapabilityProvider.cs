using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

// Motion primitives of one protocol, never of a brand (ADR-22); positions are resolved above it (ADR-59).
public interface IPtzCapabilityProvider
{
    SupportedProtocol Protocol { get; }

    // Steps in one direction that cover the whole mechanical range from anywhere: how far homing goes (ADR-59).
    int FullRangeSteps { get; }

    // The real check against the camera; Verified is only ever set from its answer, never declared.
    Task<bool> ProbeAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default);

    Task PtzMoveAsync(Camera camera, CameraCapabilityBinding binding, PtzDirection direction, int speed, CancellationToken ct = default);

    Task PtzStopAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default);

    Task PtzGoToPresetAsync(Camera camera, CameraCapabilityBinding binding, int presetId, CancellationToken ct = default);

    Task PtzSavePresetAsync(Camera camera, CameraCapabilityBinding binding, int presetId, CancellationToken ct = default);

    // False when skipped for a step still running; a camera that refused or was unreachable raises a CameraCommandException (ADR-56).
    Task<bool> PtzStepAsync(Camera camera, CameraCapabilityBinding binding, PtzDirection direction, int speed, CancellationToken ct = default);

    // Current pan/tilt in normalized ONVIF space [-1, 1], or null when the camera cannot report it.
    Task<(float Pan, float Tilt)?> GetPtzPositionAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default);
}
