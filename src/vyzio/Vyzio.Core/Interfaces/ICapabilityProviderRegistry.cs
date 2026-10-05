using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

// Resolution is by (capability, protocol), never by vendor (ADR-22, ADR-71).
public interface ICapabilityProviderRegistry
{
    // Throws if no provider is registered for the given protocol — a missing registration
    // must fail loudly, never silently fall back to a no-op.
    IPtzCapabilityProvider ResolvePtz(SupportedProtocol protocol);

    IPrivacyCapabilityProvider ResolvePrivacy(SupportedProtocol protocol);

    IImageSettingsCapabilityProvider ResolveImageSettings(SupportedProtocol protocol);

    IStreamCapabilityProvider ResolveStream(SupportedProtocol protocol);

    // Protocols with a registered provider for this capability, in its priority order (ADR-71 b); empty for none.
    IReadOnlyList<SupportedProtocol> GetRegisteredProtocols(CameraCapability capability);
}
