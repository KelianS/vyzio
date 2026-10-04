using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.CapabilityProviders;
using Vyzio.Infrastructure.VendorAdapters;
using Vyzio.Tests.Contracts;
using Vyzio.Tests.Services;

namespace Vyzio.Tests.UseCases;

// The ADR-28 cascade driven through the real ONVIF PTZ probe, DVRIP standing in behind it.
public class OnvifPtzCascadeTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly ICameraProtocolEndpointCache _endpointCache = Substitute.For<ICameraProtocolEndpointCache>();
    private readonly IPtzCapabilityProvider _dvripPtz = Substitute.For<IPtzCapabilityProvider>();
    private readonly Camera _camera = new()
    {
        Id = "cam1",
        Slug = "cam1",
        FrigateCameraName = "cam1",
        DisplayName = "cam1",
        Host = "192.0.2.10",
        VendorFamily = VendorFamily.Icsee,
    };
    private CameraCapabilityBinding? _storedPtz;

    public OnvifPtzCascadeTests()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(_camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(_ => _storedPtz);
        _bindings.When(b => b.SaveAsync(Arg.Is<CameraCapabilityBinding>(x => x.Capability == CameraCapability.Ptz), Arg.Any<CancellationToken>()))
            .Do(call => _storedPtz = call.Arg<CameraCapabilityBinding>());
        _registry.ResolveImageSettings(Arg.Any<SupportedProtocol>()).Returns(Substitute.For<IImageSettingsCapabilityProvider>());
        _registry.GetRegisteredProtocols(Arg.Any<CameraCapability>()).Returns([]);
        _registry.ResolvePtz(SupportedProtocol.Dvrip).Returns(_dvripPtz);
        _dvripPtz.ProveAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(CapabilityProof.Proven());
    }

    private SeedAndProbePresetsUseCase MakeCascadeOver(FakeOnvifCamera onvifCamera)
    {
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient("onvif").Returns(_ => new HttpClient(onvifCamera, disposeHandler: false));
        var resolver = new OnvifEndpointResolver(factory, TimeProvider.System, NullLogger<OnvifEndpointResolver>.Instance);
        var onvif = new OnvifClient(factory, resolver, TimeProvider.System, NullLogger<OnvifClient>.Instance);
        _registry.ResolvePtz(SupportedProtocol.Onvif).Returns(new OnvifPtzProvider(onvif, new PtzMoveRunner(TimeProvider.System, NullLogger<PtzMoveRunner>.Instance), NullLogger<OnvifPtzProvider>.Instance));
        return CapabilityTestUseCases.Seed(_cameras, _bindings, _registry, _endpointCache);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldBindPtzToDvrip_WhenAnIcseeOnvifProfileCarriesNoPtzConfiguration()
    {
        // Arrange
        var cascade = MakeCascadeOver(new FakeOnvifCamera(FakeOnvifCamera.ProfileWithoutPtzXml, FakeOnvifCamera.PtzOptionsXml));

        // Act
        await cascade.ExecuteAsync("cam1");

        // Assert
        Assert.Equal(SupportedProtocol.Dvrip, _storedPtz?.Protocol);
        Assert.True(_storedPtz?.Verified);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepPtzOnOnvifWithoutTryingDvrip_WhenTheOnvifProfileDescribesPtz()
    {
        // Arrange
        var cascade = MakeCascadeOver(FakeOnvifCamera.Replaying(
            CapturedVariant.TapoC200,
            OnvifScenario.Discovery, OnvifScenario.GetServices, OnvifScenario.GetProfiles, OnvifScenario.PtzGetConfigurationOptions, OnvifScenario.PtzGetPresets));

        // Act
        await cascade.ExecuteAsync("cam1");

        // Assert
        Assert.Equal(SupportedProtocol.Onvif, _storedPtz?.Protocol);
        Assert.True(_storedPtz?.Verified);
        await _dvripPtz.DidNotReceive().ProveAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepAManualOnvifChoiceButUnverifyIt_WhenTheOnvifProbeAnswersNo()
    {
        // Arrange
        var manual = new CameraCapabilityBinding
        {
            CameraId = "cam1",
            Capability = CameraCapability.Ptz,
            Protocol = SupportedProtocol.Onvif,
            Status = CapabilityStatus.Verified,
            ManuallyConfigured = true,
        };
        _storedPtz = manual;
        var cascade = MakeCascadeOver(new FakeOnvifCamera(FakeOnvifCamera.ProfileWithoutPtzXml, FakeOnvifCamera.PtzOptionsXml));

        // Act
        await cascade.ExecuteAsync("cam1");

        // Assert
        Assert.Equal(SupportedProtocol.Onvif, manual.Protocol);
        Assert.False(manual.Verified);
        await _dvripPtz.DidNotReceive().ProveAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }
}
