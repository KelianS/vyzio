using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.VendorPresets;

// Default capability bindings proposed at onboarding for a recognized vendor (ADR-22).
// Adding a new brand that speaks an already-supported protocol means adding an entry here
// plus a vendors/*.md doc — no new code.
public static class VendorCapabilityPresets
{
    public static readonly IReadOnlyList<VendorCapabilityPreset> All =
    [
        new VendorCapabilityPreset(VendorFamily.TplinkTapo,
        [
            (CameraCapability.PrivacyMode, CapabilityProtocol.TapoKlap),
            (CameraCapability.Ptz, CapabilityProtocol.TapoKlap),
        ]),
        new VendorCapabilityPreset(VendorFamily.Icsee,
        [
            (CameraCapability.Ptz, CapabilityProtocol.Dvrip),
            (CameraCapability.PrivacyMode, CapabilityProtocol.PtzParking),
        ]),
        new VendorCapabilityPreset(VendorFamily.V380Pro,
        [
            (CameraCapability.Ptz, CapabilityProtocol.Onvif),
            (CameraCapability.PrivacyMode, CapabilityProtocol.PtzParking),
        ]),
    ];

    public static VendorCapabilityPreset? GetByVendorFamily(VendorFamily vendorFamily)
        => All.FirstOrDefault(p => p.VendorFamily == vendorFamily);
}
