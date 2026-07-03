using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

// Replaces the privacy half of IVendorCameraAdapter (ADR-22). Resolved by CapabilityProtocol,
// never by VendorFamily.
public interface IPrivacyCapabilityProvider
{
    CapabilityProtocol Protocol { get; }

    // Executes a real connectivity/capability check against the camera. Verified must only
    // ever be set to true as a result of this call — never declaratively.
    Task<bool> ProbeAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default);

    Task SetPrivacyModeAsync(Camera camera, CameraCapabilityBinding binding, bool active, CancellationToken ct = default);
}
