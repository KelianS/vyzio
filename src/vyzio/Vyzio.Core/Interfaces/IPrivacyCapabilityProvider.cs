using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

// Hardware-level privacy provider (ADR-22). Resolved by SupportedProtocol.
// Only hardware privacy implementations register here (e.g. TapoKlap lens mask).
// PTZ parking and software-only strategies are handled directly in ToggleCameraPrivacyModeUseCase.
public interface IPrivacyCapabilityProvider
{
    SupportedProtocol Protocol { get; }

    // The capability's read-only proof, once its protocol answered; never a login, never a move (ADR-66).
    Task<CapabilityProof> ProveAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default);

    Task SetPrivacyModeAsync(Camera camera, CameraCapabilityBinding binding, bool active, CancellationToken ct = default);
}
