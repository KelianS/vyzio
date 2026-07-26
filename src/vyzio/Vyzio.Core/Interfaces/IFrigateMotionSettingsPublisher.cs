using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

// Applies a motion sensitivity level to a running Frigate instance without restarting it (ADR-35).
// Frigate accepts this setting as a runtime command and forgets it on restart, which is why the
// level is also persisted on the camera and written into the generated config.
public interface IFrigateMotionSettingsPublisher
{
    // Returns false when the setting could not be delivered — the caller must not treat the new
    // level as applied. Never throws for transport failures.
    Task<bool> TryPublishSensitivityAsync(
        string frigateCameraName,
        MotionSensitivity sensitivity,
        CancellationToken ct = default);
}
