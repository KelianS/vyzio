using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.CapabilityProviders;

// Resolves capability providers by (capability, protocol) — a typed, compile-checked
// dimension — never by VendorFamily string (ADR-22). Replaces IVendorCameraAdapterFactory.
public sealed class CapabilityProviderRegistry : ICapabilityProviderRegistry
{
    private readonly IReadOnlyDictionary<SupportedProtocol, IPtzCapabilityProvider> _ptzProviders;
    private readonly IReadOnlyDictionary<SupportedProtocol, IPrivacyCapabilityProvider> _privacyProviders;
    private readonly IReadOnlyDictionary<SupportedProtocol, IImageSettingsCapabilityProvider> _imageSettingsProviders;

    public CapabilityProviderRegistry(
        IEnumerable<IPtzCapabilityProvider> ptzProviders,
        IEnumerable<IPrivacyCapabilityProvider> privacyProviders,
        IEnumerable<IImageSettingsCapabilityProvider> imageSettingsProviders)
    {
        _ptzProviders = ptzProviders.ToDictionary(p => p.Protocol);
        _privacyProviders = privacyProviders.ToDictionary(p => p.Protocol);
        _imageSettingsProviders = imageSettingsProviders.ToDictionary(p => p.Protocol);
    }

    public IPtzCapabilityProvider ResolvePtz(SupportedProtocol protocol)
        => _ptzProviders.TryGetValue(protocol, out var provider)
            ? provider
            : throw new InvalidOperationException($"No IPtzCapabilityProvider registered for protocol '{protocol}'.");

    public IPrivacyCapabilityProvider ResolvePrivacy(SupportedProtocol protocol)
        => _privacyProviders.TryGetValue(protocol, out var provider)
            ? provider
            : throw new InvalidOperationException($"No IPrivacyCapabilityProvider registered for protocol '{protocol}'.");

    public IImageSettingsCapabilityProvider ResolveImageSettings(SupportedProtocol protocol)
        => _imageSettingsProviders.TryGetValue(protocol, out var provider)
            ? provider
            : throw new InvalidOperationException($"No IImageSettingsCapabilityProvider registered for protocol '{protocol}'.");
}
