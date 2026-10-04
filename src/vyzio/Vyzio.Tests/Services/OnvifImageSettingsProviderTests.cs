using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.CapabilityProviders;
using Vyzio.Infrastructure.VendorAdapters;
using Vyzio.Tests.Contracts;

namespace Vyzio.Tests.Services;

public class OnvifImageSettingsProviderTests
{
    // A resolved address, so these tests exercise the provider, not the sweep (ADR-56).
    private static Camera MakeCamera()
    {
        var camera = new Camera
        {
            Id = "cam1",
            Slug = "cam1",
            FrigateCameraName = "cam1",
            DisplayName = "ONVIF Cam",
            Host = "192.168.1.100",
            Username = "admin",
            Password = "pass",
        };
        camera.SetProtocolEndpoint(SupportedProtocol.Onvif, "http://192.168.1.100:8899/onvif/device_service");
        return camera;
    }

    private static CameraCapabilityBinding MakeBinding() => new()
    {
        CameraId = "cam1",
        Capability = CameraCapability.ImageSettings,
        Protocol = SupportedProtocol.Onvif,
        Status = CapabilityStatus.Failed,
    };

    // A Tapo C200 as captured: its profiles carry the video source as a child element of their configuration.
    private static (OnvifImageSettingsProvider provider, FakeOnvifCamera camera) MakeProvider()
    {
        var camera = FakeOnvifCamera.Replaying(
            CapturedVariant.TapoC200, OnvifScenario.GetServices, OnvifScenario.GetProfiles, OnvifScenario.ImagingGetImagingSettings);
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient("onvif").Returns(_ => new HttpClient(camera, disposeHandler: false));
        var resolver = new OnvifEndpointResolver(factory, TimeProvider.System, NullLogger<OnvifEndpointResolver>.Instance);
        var onvifClient = new OnvifClient(factory, resolver, TimeProvider.System, NullLogger<OnvifClient>.Instance);
        return (new OnvifImageSettingsProvider(onvifClient), camera);
    }

    [Fact]
    public async Task ProveAsync_ShouldProveImageSettings_WhenTheVideoSourceTokenAndItsSettingsResolve()
    {
        // Arrange
        var (provider, _) = MakeProvider();

        // Act
        var result = await provider.ProveAsync(MakeCamera(), MakeBinding());

        // Assert
        Assert.Equal(ProofOutcome.Proven, result.Outcome);
    }

    [Fact]
    public async Task GetImageSettingsAsync_ShouldReadTheSettingsOfTheVideoSource_WhenItsTokenIsAChildElementRatherThanAnAttribute()
    {
        // Arrange
        var (provider, camera) = MakeProvider();

        // Act
        var settings = await provider.GetImageSettingsAsync(MakeCamera(), MakeBinding());

        // Assert
        Assert.NotNull(settings);
        Assert.Contains("<VideoSourceToken>raw_vs1</VideoSourceToken>", camera.Bodies.Last(), StringComparison.Ordinal);
    }
}
