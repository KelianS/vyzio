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
    private readonly IReadOnlyList<SupportedProtocol> _ptzProtocolOrder;
    private readonly IReadOnlyList<SupportedProtocol> _privacyProtocolOrder;
    private readonly IReadOnlyList<SupportedProtocol> _imageSettingsProtocolOrder;
    private readonly IReadOnlyList<SupportedProtocol> _streamProtocolOrder;

    public CapabilityProviderRegistry(
        IEnumerable<IPtzCapabilityProvider> ptzProviders,
        IEnumerable<IPrivacyCapabilityProvider> privacyProviders,
        IEnumerable<IImageSettingsCapabilityProvider> imageSettingsProviders,
        IEnumerable<IStreamCapabilityProvider>? streamProviders = null)
    {
        var ptz = ptzProviders.ToList();
        var privacy = privacyProviders.ToList();
        var imageSettings = imageSettingsProviders.ToList();
        var stream = (streamProviders ?? []).ToList();

        _ptzProviders = ptz.ToDictionary(p => p.Protocol);
        _privacyProviders = privacy.ToDictionary(p => p.Protocol);
        _imageSettingsProviders = imageSettings.ToDictionary(p => p.Protocol);

        // Preserves DI registration order (ServiceCollectionExtensions), not dictionary enumeration
        // order — blind detection (ADR-28) tries the richest/standard protocol first (ONVIF).
        _ptzProtocolOrder = ptz.Select(p => p.Protocol).ToList();
        _privacyProtocolOrder = privacy.Select(p => p.Protocol).ToList();
        _imageSettingsProtocolOrder = imageSettings.Select(p => p.Protocol).ToList();
        _streamProtocolOrder = stream.Select(p => p.Protocol).ToList();
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

    public IReadOnlyList<SupportedProtocol> GetRegisteredProtocols(CameraCapability capability) => capability switch
    {
        CameraCapability.Stream => _streamProtocolOrder,
        CameraCapability.Ptz => _ptzProtocolOrder,
        CameraCapability.HardwarePrivacy => _privacyProtocolOrder,
        CameraCapability.ImageSettings => _imageSettingsProtocolOrder,
        _ => [],
    };
}
