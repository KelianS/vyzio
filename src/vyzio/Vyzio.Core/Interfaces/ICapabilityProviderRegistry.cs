using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

// Replaces IVendorCameraAdapterFactory (ADR-22). Resolution is by (capability, protocol) —
// a typed, compile-checked dimension — never by VendorFamily string.
public interface ICapabilityProviderRegistry
{
    // Throws if no provider is registered for the given protocol — a missing registration
    // must fail loudly, never silently fall back to a no-op.
    IPtzCapabilityProvider ResolvePtz(CapabilityProtocol protocol);

    IPrivacyCapabilityProvider ResolvePrivacy(CapabilityProtocol protocol);
}
