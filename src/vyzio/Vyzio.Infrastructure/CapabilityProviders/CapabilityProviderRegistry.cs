using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.CapabilityProviders;

// Resolves capability providers by (capability, protocol), never by vendor (ADR-22, ADR-71).
public sealed class CapabilityProviderRegistry : ICapabilityProviderRegistry
{
    private readonly IReadOnlyDictionary<SupportedProtocol, IPtzCapabilityProvider> _ptzProviders;
    private readonly IReadOnlyDictionary<SupportedProtocol, IPrivacyCapabilityProvider> _privacyProviders;
    private readonly IReadOnlyDictionary<SupportedProtocol, IImageSettingsCapabilityProvider> _imageSettingsProviders;
    private readonly IReadOnlyDictionary<SupportedProtocol, IStreamCapabilityProvider> _streamProviders;
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
        _streamProviders = stream.ToDictionary(p => p.Protocol);

        // Detection tries them in this order, whatever order they were registered in (ADR-71 b).
        _ptzProtocolOrder = CapabilityProtocolPriority.Sort(CameraCapability.Ptz, ptz.Select(p => p.Protocol));
        _privacyProtocolOrder = CapabilityProtocolPriority.Sort(CameraCapability.HardwarePrivacy, privacy.Select(p => p.Protocol));
        _imageSettingsProtocolOrder = CapabilityProtocolPriority.Sort(CameraCapability.ImageSettings, imageSettings.Select(p => p.Protocol));
        _streamProtocolOrder = CapabilityProtocolPriority.Sort(CameraCapability.Stream, stream.Select(p => p.Protocol));
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

    public IStreamCapabilityProvider ResolveStream(SupportedProtocol protocol)
        => _streamProviders.TryGetValue(protocol, out var provider)
            ? provider
            : throw new InvalidOperationException($"No IStreamCapabilityProvider registered for protocol '{protocol}'.");

    public IReadOnlyList<SupportedProtocol> GetRegisteredProtocols(CameraCapability capability) => capability switch
    {
        CameraCapability.Stream => _streamProtocolOrder,
        CameraCapability.Ptz => _ptzProtocolOrder,
        CameraCapability.HardwarePrivacy => _privacyProtocolOrder,
        CameraCapability.ImageSettings => _imageSettingsProtocolOrder,
        _ => [],
    };
}
