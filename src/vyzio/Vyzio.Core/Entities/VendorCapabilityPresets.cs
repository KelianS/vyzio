namespace Vyzio.Core.Entities;

// Default capability bindings proposed at onboarding for a recognized vendor (ADR-22).
// Adding a new brand that speaks an already-supported protocol means adding an entry here
// plus a vendors/*.md doc — no new code.
//
// Note: PrivacyMode is no longer a capability binding. Privacy strategy is set on Camera
// directly (Camera.PrivacyStrategy). Only HardwarePrivacy bindings (TapoKlap) remain here.
public static class VendorCapabilityPresets
{
    public static readonly IReadOnlyList<VendorCapabilityPreset> All =
    [
        new VendorCapabilityPreset(VendorFamily.TplinkTapo,
        [
            // PTZ and image settings are served over ONVIF, verified on a C200 against real hardware
            // (ADR-56). The proprietary protocol is not a fallback for them: Tapo cameras do not even
            // open the port it assumes.
            (CameraCapability.Ptz, new[] { SupportedProtocol.Onvif }),
            (CameraCapability.ImageSettings, new[] { SupportedProtocol.Onvif }),
            // The hardware lens cut has no ONVIF equivalent on this firmware, so it stays on the
            // vendor protocol, which is not validated yet (issue #88). Until it is, a Tapo falls back
            // to PtzParking for privacy (ADR-25), which is why an unverified binding here is harmless.
            (CameraCapability.HardwarePrivacy, new[] { SupportedProtocol.TapoKlap }),
        ]),
        new VendorCapabilityPreset(VendorFamily.Icsee,
        [
            // Some ICSee units also expose ONVIF alongside their native DVRIP stack — try ONVIF
            // first (richer, standard protocol), fall back to DVRIP (ADR-28).
            (CameraCapability.Ptz, new[] { SupportedProtocol.Onvif, SupportedProtocol.Dvrip }),
            // No ONVIF Imaging equivalent confirmed for ICSee — DVRIP only (ADR-29).
            (CameraCapability.ImageSettings, new[] { SupportedProtocol.Dvrip }),
        ]),
        new VendorCapabilityPreset(VendorFamily.V380Pro,
        [
            (CameraCapability.Ptz, new[] { SupportedProtocol.V380 }),
            // Not preset: ONVIF Imaging returned a definitive SOAP fault on real hardware test
            // (2026-07-14, "GetImagingSettings not implemented" — firmware genuinely lacks the
            // service). A native V380 IR-light command was also attempted (ADR-30) and reverted:
            // its only source (github.com/prsyahmi/v380) never confirmed it worked, and the
            // camera's own official app has no such setting at all — no path exists to verify it,
            // so it's not offered rather than shipping a control confirmed to do nothing (ADR-22).
            // Still addable by hand for a unit that might behave differently.
        ]),
    ];

    public static VendorCapabilityPreset? GetByVendorFamily(VendorFamily vendorFamily)
        => All.FirstOrDefault(p => p.VendorFamily == vendorFamily);
}
