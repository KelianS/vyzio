namespace Vyzio.Core.Entities;

// Default capability bindings proposed at onboarding for a recognized vendor family (ADR-22).
// A "supported" brand is a brand for which Vyzio already knows this configuration — the brand
// itself never drives runtime behavior, only this preset does (via the protocol it points to).
//
// Protocols is an ordered priority list, not a single value (ADR-28): a vendor can plausibly
// speak more than one protocol for the same capability (e.g. an ICSee unit that also exposes
// ONVIF). SeedAndProbePresetsUseCase tries each candidate in order and keeps the first that
// probes successfully.
public sealed record VendorCapabilityPreset(
    VendorFamily VendorFamily,
    IReadOnlyList<(CameraCapability Capability, IReadOnlyList<SupportedProtocol> Protocols)> DefaultBindings);
