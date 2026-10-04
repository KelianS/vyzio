using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

// Image settings capability (ADR-27): brightness, contrast, saturation, sharpness, IR-cut
// mode. Resolved by SupportedProtocol, same pattern as IPtzCapabilityProvider. Unlike PTZ,
// there is no state to persist on the Vyzio side — the camera is the only source of truth.
public interface IImageSettingsCapabilityProvider
{
    SupportedProtocol Protocol { get; }

    // The capability's read-only proof, once its protocol answered; never a login, never a move (ADR-66).
    Task<CapabilityProof> ProveAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default);

    // Returns null if the camera did not return usable settings (unreachable, malformed response).
    Task<CameraImageSettings?> GetImageSettingsAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default);

    Task SetImageSettingsAsync(Camera camera, CameraCapabilityBinding binding, CameraImageSettings settings, CancellationToken ct = default);
}
