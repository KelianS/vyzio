using NSubstitute;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.CapabilityProviders;

namespace Vyzio.Tests.Services;

public class CapabilityProviderRegistryTests
{
    private static IPtzCapabilityProvider MakePtz(CapabilityProtocol protocol)
    {
        var p = Substitute.For<IPtzCapabilityProvider>();
        p.Protocol.Returns(protocol);
        return p;
    }

    private static IPrivacyCapabilityProvider MakePrivacy(CapabilityProtocol protocol)
    {
        var p = Substitute.For<IPrivacyCapabilityProvider>();
        p.Protocol.Returns(protocol);
        return p;
    }

    [Fact]
    public void ResolvePtz_returns_registered_provider()
    {
        var onvif = MakePtz(CapabilityProtocol.Onvif);
        var sut = new CapabilityProviderRegistry([onvif], []);

        Assert.Same(onvif, sut.ResolvePtz(CapabilityProtocol.Onvif));
    }

    [Fact]
    public void ResolvePrivacy_returns_registered_provider()
    {
        var tapo = MakePrivacy(CapabilityProtocol.TapoKlap);
        var sut = new CapabilityProviderRegistry([], [tapo]);

        Assert.Same(tapo, sut.ResolvePrivacy(CapabilityProtocol.TapoKlap));
    }

    [Fact]
    public void ResolvePtz_throws_for_unregistered_protocol()
    {
        var sut = new CapabilityProviderRegistry([], []);

        Assert.Throws<InvalidOperationException>(() => sut.ResolvePtz(CapabilityProtocol.Dvrip));
    }

    [Fact]
    public void ResolvePrivacy_throws_for_unregistered_protocol()
    {
        var sut = new CapabilityProviderRegistry([], []);

        Assert.Throws<InvalidOperationException>(() => sut.ResolvePrivacy(CapabilityProtocol.TapoKlap));
    }

    [Fact]
    public void ResolvePtz_distinguishes_multiple_registered_protocols()
    {
        var onvif = MakePtz(CapabilityProtocol.Onvif);
        var dvrip = MakePtz(CapabilityProtocol.Dvrip);
        var sut = new CapabilityProviderRegistry([onvif, dvrip], []);

        Assert.Same(onvif, sut.ResolvePtz(CapabilityProtocol.Onvif));
        Assert.Same(dvrip, sut.ResolvePtz(CapabilityProtocol.Dvrip));
    }

    [Fact]
    public void ResolvePrivacy_distinguishes_multiple_registered_protocols()
    {
        var tapo = MakePrivacy(CapabilityProtocol.TapoKlap);
        var sw = MakePrivacy(CapabilityProtocol.SoftwareOnly);
        var sut = new CapabilityProviderRegistry([], [tapo, sw]);

        Assert.Same(tapo, sut.ResolvePrivacy(CapabilityProtocol.TapoKlap));
        Assert.Same(sw, sut.ResolvePrivacy(CapabilityProtocol.SoftwareOnly));
    }

    [Fact]
    public void ResolvePtz_throws_for_unknown_protocol_even_with_other_providers_registered()
    {
        var sut = new CapabilityProviderRegistry([MakePtz(CapabilityProtocol.Onvif)], []);

        Assert.Throws<InvalidOperationException>(() => sut.ResolvePtz(CapabilityProtocol.Dvrip));
    }
}
