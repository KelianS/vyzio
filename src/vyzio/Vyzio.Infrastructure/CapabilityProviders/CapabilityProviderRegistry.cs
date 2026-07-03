using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.CapabilityProviders;

// Resolves capability providers by (capability, protocol) — a typed, compile-checked
// dimension — never by VendorFamily string (ADR-22). Replaces IVendorCameraAdapterFactory.
public sealed class CapabilityProviderRegistry : ICapabilityProviderRegistry
{
    private readonly IReadOnlyDictionary<CapabilityProtocol, IPtzCapabilityProvider> _ptzProviders;
    private readonly IReadOnlyDictionary<CapabilityProtocol, IPrivacyCapabilityProvider> _privacyProviders;

    public CapabilityProviderRegistry(
        IEnumerable<IPtzCapabilityProvider> ptzProviders,
        IEnumerable<IPrivacyCapabilityProvider> privacyProviders)
    {
        _ptzProviders = ptzProviders.ToDictionary(p => p.Protocol);
        _privacyProviders = privacyProviders.ToDictionary(p => p.Protocol);
    }

    public IPtzCapabilityProvider ResolvePtz(CapabilityProtocol protocol)
        => _ptzProviders.TryGetValue(protocol, out var provider)
            ? provider
            : throw new InvalidOperationException($"No IPtzCapabilityProvider registered for protocol '{protocol}'.");

    public IPrivacyCapabilityProvider ResolvePrivacy(CapabilityProtocol protocol)
        => _privacyProviders.TryGetValue(protocol, out var provider)
            ? provider
            : throw new InvalidOperationException($"No IPrivacyCapabilityProvider registered for protocol '{protocol}'.");
}
