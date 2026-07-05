using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

// Replaces the PTZ half of IVendorCameraAdapter (ADR-22). Resolved by SupportedProtocol,
// never by VendorFamily — a single implementation can serve every brand that speaks the
// same protocol (e.g. OnvifPtzProvider covers V380, Hikvision, Dahua, Reolink, Axis...).
public interface IPtzCapabilityProvider
{
    SupportedProtocol Protocol { get; }

    // Executes a real connectivity/capability check against the camera. Verified must only
    // ever be set to true as a result of this call — never declaratively.
    // camera: provides Host, Username, Password (base connectivity)
    // binding: provides ConfigJson (protocol-specific overrides, e.g. custom ONVIF port)
    Task<bool> ProbeAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default);

    Task PtzMoveAsync(Camera camera, CameraCapabilityBinding binding, PtzDirection direction, int speed, CancellationToken ct = default);

    Task PtzStopAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default);

    Task PtzGoToPresetAsync(Camera camera, CameraCapabilityBinding binding, int presetId, CancellationToken ct = default);

    Task PtzSavePresetAsync(Camera camera, CameraCapabilityBinding binding, int presetId, CancellationToken ct = default);

    // Single precise step. Implementations that support native relative moves (ONVIF
    // RelativeMove) should override — the default fallback is Move+Stop which is imprecise.
    virtual async Task PtzStepAsync(Camera camera, CameraCapabilityBinding binding, PtzDirection direction, int speed, CancellationToken ct = default)
    {
        await PtzMoveAsync(camera, binding, direction, speed, ct);
        await PtzStopAsync(camera, binding, ct);
    }

    // Returns current pan/tilt position in normalized ONVIF space [-1, 1], or null if not supported.
    virtual Task<(float Pan, float Tilt)?> GetPtzPositionAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
        => Task.FromResult<(float Pan, float Tilt)?>(null);
}
