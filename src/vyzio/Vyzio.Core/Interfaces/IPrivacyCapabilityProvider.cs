using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

// Hardware-level privacy provider (ADR-22). Resolved by SupportedProtocol.
// Only hardware privacy implementations register here (e.g. TapoKlap lens mask).
// PTZ parking and software-only strategies are handled directly in ToggleCameraPrivacyModeUseCase.
public interface IPrivacyCapabilityProvider
{
    SupportedProtocol Protocol { get; }

    // Executes a real connectivity/capability check against the camera. Verified must only
    // ever be set to true as a result of this call — never declaratively.
    Task<bool> ProbeAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default);

    Task SetPrivacyModeAsync(Camera camera, CameraCapabilityBinding binding, bool active, CancellationToken ct = default);
}
