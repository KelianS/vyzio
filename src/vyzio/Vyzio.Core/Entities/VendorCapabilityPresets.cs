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
            (CameraCapability.HardwarePrivacy, new[] { SupportedProtocol.TapoKlap }),
            (CameraCapability.Ptz, new[] { SupportedProtocol.TapoKlap }),
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
            // Not preset: real hardware test (2026-07-14) returned a definitive ONVIF SOAP fault
            // ("GetImagingSettings not implemented") — this isn't a transient network issue, the
            // firmware genuinely lacks the Imaging service. Never suggest a capability confirmed
            // broken; still addable by hand for a unit that might behave differently (ADR-27/29).
        ]),
    ];

    public static VendorCapabilityPreset? GetByVendorFamily(VendorFamily vendorFamily)
        => All.FirstOrDefault(p => p.VendorFamily == vendorFamily);
}
