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

    private static IImageSettingsCapabilityProvider MakeImageSettings(SupportedProtocol protocol)
    {
        var p = Substitute.For<IImageSettingsCapabilityProvider>();
        p.Protocol.Returns(protocol);
        return p;
    }

    private static IStreamCapabilityProvider MakeStream(SupportedProtocol protocol)
    {
        var p = Substitute.For<IStreamCapabilityProvider>();
        p.Protocol.Returns(protocol);
        return p;
    }

    [Fact]
    public void GetRegisteredProtocols_ShouldListStreamProtocolsInRegistrationOrder_WhenSeveralStreamProvidersAreRegistered()
    {
        var rtsp = MakeStream(SupportedProtocol.Rtsp);
        var dvrip = MakeStream(SupportedProtocol.Dvrip);
        var sut = new CapabilityProviderRegistry([], [], [], [rtsp, dvrip]);

        Assert.Equal([SupportedProtocol.Rtsp, SupportedProtocol.Dvrip], sut.GetRegisteredProtocols(CameraCapability.Stream));
    }

    [Fact]
    public void ResolvePtz_ShouldReturnTheProvider_WhenItsProtocolIsRegistered()
    {
        var onvif = MakePtz(SupportedProtocol.Onvif);
        var sut = new CapabilityProviderRegistry([onvif], [], []);

        Assert.Same(onvif, sut.ResolvePtz(SupportedProtocol.Onvif));
    }

    [Fact]
    public void ResolvePrivacy_ShouldReturnTheProvider_WhenItsProtocolIsRegistered()
    {
        var tapo = MakePrivacy(SupportedProtocol.TapoKlap);
        var sut = new CapabilityProviderRegistry([], [tapo], []);

        Assert.Same(tapo, sut.ResolvePrivacy(SupportedProtocol.TapoKlap));
    }

    [Fact]
    public void ResolveImageSettings_ShouldReturnTheProvider_WhenItsProtocolIsRegistered()
    {
        var onvif = MakeImageSettings(SupportedProtocol.Onvif);
        var sut = new CapabilityProviderRegistry([], [], [onvif]);

        Assert.Same(onvif, sut.ResolveImageSettings(SupportedProtocol.Onvif));
    }

    [Fact]
    public void ResolvePtz_ShouldThrow_WhenNoProviderIsRegistered()
    {
        var sut = new CapabilityProviderRegistry([], [], []);

        Assert.Throws<InvalidOperationException>(() => sut.ResolvePtz(SupportedProtocol.Dvrip));
    }

    [Fact]
    public void ResolvePrivacy_ShouldThrow_WhenNoProviderIsRegistered()
    {
        var sut = new CapabilityProviderRegistry([], [], []);

        Assert.Throws<InvalidOperationException>(() => sut.ResolvePrivacy(SupportedProtocol.TapoKlap));
    }

    [Fact]
    public void ResolveImageSettings_ShouldThrow_WhenNoProviderIsRegistered()
    {
        var sut = new CapabilityProviderRegistry([], [], []);

        Assert.Throws<InvalidOperationException>(() => sut.ResolveImageSettings(SupportedProtocol.Dvrip));
    }

    [Fact]
    public void ResolvePtz_ShouldReturnTheMatchingProvider_WhenSeveralProtocolsAreRegistered()
    {
        var onvif = MakePtz(SupportedProtocol.Onvif);
        var dvrip = MakePtz(SupportedProtocol.Dvrip);
        var sut = new CapabilityProviderRegistry([onvif, dvrip], [], []);

        Assert.Same(onvif, sut.ResolvePtz(SupportedProtocol.Onvif));
        Assert.Same(dvrip, sut.ResolvePtz(SupportedProtocol.Dvrip));
    }

    [Fact]
    public void ResolvePrivacy_ShouldReturnTheMatchingProvider_WhenSeveralProtocolsAreRegistered()
    {
        var tapo = MakePrivacy(SupportedProtocol.TapoKlap);
        var dvrip = MakePrivacy(SupportedProtocol.Dvrip);
        var sut = new CapabilityProviderRegistry([], [tapo, dvrip], []);

        Assert.Same(tapo, sut.ResolvePrivacy(SupportedProtocol.TapoKlap));
        Assert.Same(dvrip, sut.ResolvePrivacy(SupportedProtocol.Dvrip));
    }

    [Fact]
    public void ResolvePtz_ShouldThrow_WhenOnlyOtherProtocolsAreRegistered()
    {
        var sut = new CapabilityProviderRegistry([MakePtz(SupportedProtocol.Onvif)], [], []);

        Assert.Throws<InvalidOperationException>(() => sut.ResolvePtz(SupportedProtocol.Dvrip));
    }

    [Fact]
    public void GetRegisteredProtocols_ShouldListPtzProtocolsInRegistrationOrder_WhenSeveralPtzProvidersAreRegistered()
    {
        var onvif = MakePtz(SupportedProtocol.Onvif);
        var dvrip = MakePtz(SupportedProtocol.Dvrip);
        var sut = new CapabilityProviderRegistry([onvif, dvrip], [], []);

        Assert.Equal([SupportedProtocol.Onvif, SupportedProtocol.Dvrip], sut.GetRegisteredProtocols(CameraCapability.Ptz));
    }

    [Fact]
    public void GetRegisteredProtocols_ShouldListThePrivacyProtocol_WhenAskedForHardwarePrivacy()
    {
        var tapo = MakePrivacy(SupportedProtocol.TapoKlap);
        var sut = new CapabilityProviderRegistry([], [tapo], []);

        Assert.Equal([SupportedProtocol.TapoKlap], sut.GetRegisteredProtocols(CameraCapability.HardwarePrivacy));
    }

    [Fact]
    public void GetRegisteredProtocols_ShouldListImageSettingsProtocolsInRegistrationOrder_WhenSeveralImageSettingsProvidersAreRegistered()
    {
        var onvif = MakeImageSettings(SupportedProtocol.Onvif);
        var dvrip = MakeImageSettings(SupportedProtocol.Dvrip);
        var sut = new CapabilityProviderRegistry([], [], [onvif, dvrip]);

        Assert.Equal([SupportedProtocol.Onvif, SupportedProtocol.Dvrip], sut.GetRegisteredProtocols(CameraCapability.ImageSettings));
    }

    [Fact]
    public void GetRegisteredProtocols_ShouldReturnNothing_WhenNoProviderCoversTheCapability()
    {
        var sut = new CapabilityProviderRegistry([MakePtz(SupportedProtocol.Onvif)], [], []);

        Assert.Empty(sut.GetRegisteredProtocols(CameraCapability.Stream));
    }
}
