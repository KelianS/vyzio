namespace Vyzio.Core.Entities;

// Default capability bindings proposed at onboarding for a recognized vendor family (ADR-22).
// A "supported" brand is a brand for which Vyzio already knows this configuration — the brand
// itself never drives runtime behavior, only this preset does (via the protocol it points to).
public sealed record VendorCapabilityPreset(
    VendorFamily VendorFamily,
    IReadOnlyList<(CameraCapability Capability, CapabilityProtocol Protocol)> DefaultBindings);
