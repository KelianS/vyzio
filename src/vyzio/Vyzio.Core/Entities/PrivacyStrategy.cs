namespace Vyzio.Core.Entities;

// App-level privacy configuration per camera (ADR-21 update).
// Replaces PrivacyModeStrategy and removes the PtzParking/SoftwareOnly values
// that were incorrectly placed in CameraCapabilityBinding.Protocol.
public enum PrivacyStrategy
{
    None,
    SoftwareBlur,
    PtzParking,
    Hardware,
}
