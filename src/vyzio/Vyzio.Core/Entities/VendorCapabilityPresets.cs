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
            (CameraCapability.HardwarePrivacy, SupportedProtocol.TapoKlap),
            (CameraCapability.Ptz, SupportedProtocol.TapoKlap),
        ]),
        new VendorCapabilityPreset(VendorFamily.Icsee,
        [
            (CameraCapability.Ptz, SupportedProtocol.Dvrip),
        ]),
        new VendorCapabilityPreset(VendorFamily.V380Pro,
        [
            (CameraCapability.Ptz, SupportedProtocol.V380),
            (CameraCapability.ImageSettings, SupportedProtocol.Onvif),
        ]),
    ];

    public static VendorCapabilityPreset? GetByVendorFamily(VendorFamily vendorFamily)
        => All.FirstOrDefault(p => p.VendorFamily == vendorFamily);
}
