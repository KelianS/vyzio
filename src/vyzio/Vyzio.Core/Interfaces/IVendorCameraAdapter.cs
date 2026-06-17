using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IVendorCameraAdapter
{
    string VendorFamily { get; }

    // Privacy Mode (ADR-20)
    Task<bool> SupportsPrivacyModeAsync(Camera camera, CancellationToken ct = default);
    Task SetPrivacyModeAsync(Camera camera, bool active, CancellationToken ct = default);

    // PTZ (ADR-21)
    Task<bool> SupportsPtzAsync(Camera camera, CancellationToken ct = default);
    Task PtzMoveAsync(Camera camera, PtzDirection direction, int speed, CancellationToken ct = default);
    Task PtzStopAsync(Camera camera, CancellationToken ct = default);
    Task PtzGoToPresetAsync(Camera camera, int presetId, CancellationToken ct = default);
    Task PtzSavePresetAsync(Camera camera, int presetId, CancellationToken ct = default);

    // Single precise step. Adapters that support native relative moves (ONVIF RelativeMove)
    // should override — the default fallback is ContinuousMove + Stop which is imprecise.
    virtual async Task PtzStepAsync(Camera camera, PtzDirection direction, int speed, CancellationToken ct = default)
    {
        await PtzMoveAsync(camera, direction, speed, ct);
        await PtzStopAsync(camera, ct);
    }
}
