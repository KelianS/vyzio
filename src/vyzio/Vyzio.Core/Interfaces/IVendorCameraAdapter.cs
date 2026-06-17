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
}
