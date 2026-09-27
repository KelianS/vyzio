using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

// Motion primitives of one protocol, never of a brand (ADR-22); positions are resolved above it (ADR-59).
public interface IPtzCapabilityProvider
{
    SupportedProtocol Protocol { get; }

    // Motion time in one direction that covers the whole mechanical range from anywhere, an estimate until measured (ADR-60).
    TimeSpan FullRange { get; }

    // The real check against the camera; Verified is only ever set from its answer, never declared.
    Task<bool> ProbeAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default);

    Task PtzGoToPresetAsync(Camera camera, CameraCapabilityBinding binding, int presetId, CancellationToken ct = default);

    Task PtzSavePresetAsync(Camera camera, CameraCapabilityBinding binding, int presetId, CancellationToken ct = default);

    // Opens what a move needs, login included, so that no move waits on it (ADR-60).
    Task<IPtzMotion> OpenMotionAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default);

    // Current pan/tilt in normalized ONVIF space [-1, 1], or null when the camera cannot report it.
    Task<(float Pan, float Tilt)?> GetPtzPositionAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default);
}

// The moves of one camera over what the provider opened for them, failures raised as ADR-56 names them; disposing closes it (ADR-60).
public interface IPtzMotion : IAsyncDisposable
{
    // Moves for the given time and returns the motion time the camera made; zero when skipped for a move still running.
    Task<TimeSpan> MoveForAsync(PtzDirection direction, int speed, TimeSpan duration, CancellationToken ct = default);

    // Starts a move that lasts until StopAsync; false when skipped for a move still running.
    Task<bool> StartAsync(PtzDirection direction, int speed, CancellationToken ct = default);

    // Stops the started move and returns how long it moved, from the move sent to the stop sent.
    Task<TimeSpan> StopAsync();
}
