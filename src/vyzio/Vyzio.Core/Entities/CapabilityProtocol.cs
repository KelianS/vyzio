namespace Vyzio.Core.Entities;

// Protocol that actually implements a CameraCapability (ADR-22). This is the typed,
// compile-checked dimension that drives behavior — VendorFamily never does.
// PtzParking and SoftwareOnly are PrivacyMode protocols that compose an existing Ptz
// protocol rather than talking to firmware directly.
public enum CapabilityProtocol
{
    Onvif,
    Dvrip,
    TapoKlap,
    V380,
    PtzParking,
    SoftwareOnly,
    None,
}
