using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IVendorCameraAdapter
{
    string VendorFamily { get; }

    Task<bool> SupportsPrivacyModeAsync(Camera camera, CancellationToken ct = default);

    // Sets privacy mode on the camera firmware. Throws on unrecoverable error.
    Task SetPrivacyModeAsync(Camera camera, bool active, CancellationToken ct = default);

    // Stub for future system-info feature (ADR pending)
    // Task<bool> SupportsSystemInfoAsync(Camera camera, CancellationToken ct = default);
    // Task<CameraSystemInfo> GetSystemInfoAsync(Camera camera, CancellationToken ct = default);
}
