using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

// Replaces the PTZ half of IVendorCameraAdapter (ADR-22). Resolved by CapabilityProtocol,
// never by VendorFamily — a single implementation can serve every brand that speaks the
// same protocol (e.g. OnvifPtzProvider covers V380, Hikvision, Dahua, Reolink, Axis...).
public interface IPtzCapabilityProvider
{
    CapabilityProtocol Protocol { get; }

    // Executes a real connectivity/capability check against the camera. Verified must only
    // ever be set to true as a result of this call — never declaratively.
    Task<bool> ProbeAsync(CameraCapabilityBinding binding, CancellationToken ct = default);

    Task PtzMoveAsync(CameraCapabilityBinding binding, PtzDirection direction, int speed, CancellationToken ct = default);

    Task PtzStopAsync(CameraCapabilityBinding binding, CancellationToken ct = default);

    Task PtzGoToPresetAsync(CameraCapabilityBinding binding, int presetId, CancellationToken ct = default);

    Task PtzSavePresetAsync(CameraCapabilityBinding binding, int presetId, CancellationToken ct = default);

    // Single precise step. Implementations that support native relative moves (ONVIF
    // RelativeMove) should override — the default fallback is Move+Stop which is imprecise.
    virtual async Task PtzStepAsync(CameraCapabilityBinding binding, PtzDirection direction, int speed, CancellationToken ct = default)
    {
        await PtzMoveAsync(binding, direction, speed, ct);
        await PtzStopAsync(binding, ct);
    }

    // Returns current pan/tilt position in normalized ONVIF space [-1, 1], or null if not supported.
    virtual Task<(float Pan, float Tilt)?> GetPtzPositionAsync(CameraCapabilityBinding binding, CancellationToken ct = default)
        => Task.FromResult<(float Pan, float Tilt)?>(null);
}
