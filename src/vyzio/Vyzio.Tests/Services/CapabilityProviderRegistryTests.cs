using NSubstitute;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.CapabilityProviders;

namespace Vyzio.Tests.Services;

public class CapabilityProviderRegistryTests
{
    private static IPtzCapabilityProvider MakePtz(SupportedProtocol protocol)
    {
        var p = Substitute.For<IPtzCapabilityProvider>();
        p.Protocol.Returns(protocol);
        return p;
    }

    private static IPrivacyCapabilityProvider MakePrivacy(SupportedProtocol protocol)
    {
        var p = Substitute.For<IPrivacyCapabilityProvider>();
        p.Protocol.Returns(protocol);
        return p;
    }

    [Fact]
    public void ResolvePtz_returns_registered_provider()
    {
        var onvif = MakePtz(SupportedProtocol.Onvif);
        var sut = new CapabilityProviderRegistry([onvif], []);

        Assert.Same(onvif, sut.ResolvePtz(SupportedProtocol.Onvif));
    }

    [Fact]
    public void ResolvePrivacy_returns_registered_provider()
    {
        var tapo = MakePrivacy(SupportedProtocol.TapoKlap);
        var sut = new CapabilityProviderRegistry([], [tapo]);

        Assert.Same(tapo, sut.ResolvePrivacy(SupportedProtocol.TapoKlap));
    }

    [Fact]
    public void ResolvePtz_throws_for_unregistered_protocol()
    {
        var sut = new CapabilityProviderRegistry([], []);

        Assert.Throws<InvalidOperationException>(() => sut.ResolvePtz(SupportedProtocol.Dvrip));
    }

    [Fact]
    public void ResolvePrivacy_throws_for_unregistered_protocol()
    {
        var sut = new CapabilityProviderRegistry([], []);

        Assert.Throws<InvalidOperationException>(() => sut.ResolvePrivacy(SupportedProtocol.TapoKlap));
    }

    [Fact]
    public void ResolvePtz_distinguishes_multiple_registered_protocols()
    {
        var onvif = MakePtz(SupportedProtocol.Onvif);
        var dvrip = MakePtz(SupportedProtocol.Dvrip);
        var sut = new CapabilityProviderRegistry([onvif, dvrip], []);

        Assert.Same(onvif, sut.ResolvePtz(SupportedProtocol.Onvif));
        Assert.Same(dvrip, sut.ResolvePtz(SupportedProtocol.Dvrip));
    }

    [Fact]
    public void ResolvePrivacy_distinguishes_multiple_registered_protocols()
    {
        var tapo = MakePrivacy(SupportedProtocol.TapoKlap);
        var dvrip = MakePrivacy(SupportedProtocol.Dvrip);
        var sut = new CapabilityProviderRegistry([], [tapo, dvrip]);

        Assert.Same(tapo, sut.ResolvePrivacy(SupportedProtocol.TapoKlap));
        Assert.Same(dvrip, sut.ResolvePrivacy(SupportedProtocol.Dvrip));
    }

    [Fact]
    public void ResolvePtz_throws_for_unknown_protocol_even_with_other_providers_registered()
    {
        var sut = new CapabilityProviderRegistry([MakePtz(SupportedProtocol.Onvif)], []);

        Assert.Throws<InvalidOperationException>(() => sut.ResolvePtz(SupportedProtocol.Dvrip));
    }
}
