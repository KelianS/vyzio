using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.CapabilityProviders;
using Vyzio.Infrastructure.VendorAdapters;
using Vyzio.Tests.Contracts;
using Vyzio.Tests.Services;

namespace Vyzio.Tests.UseCases;

// One detection for every camera family, the real providers and registry over captured exchanges (ADR-71 b, c).
public sealed class DetectionReplayTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly Dictionary<CameraCapability, CameraCapabilityBinding> _stored = [];
    private readonly List<SupportedProtocol> _ptzTries = [];

    public DetectionReplayTests()
    {
        _bindings.GetAsync("cam1", Arg.Any<CameraCapability>(), Arg.Any<CancellationToken>())
            .Returns(call => _stored.GetValueOrDefault(call.Arg<CameraCapability>()));
        _bindings.When(b => b.SaveAsync(Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()))
            .Do(call => Store(call.Arg<CameraCapabilityBinding>()));
        _bindings.When(b => b.DeleteAsync("cam1", Arg.Any<CameraCapability>(), Arg.Any<CancellationToken>()))
            .Do(call => _stored.Remove(call.Arg<CameraCapability>()));
        _bindings.GetByCameraAsync("cam1", Arg.Any<CancellationToken>()).Returns(_ => _stored.Values.ToList());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldProvePtzAndImageSettingsOverOnvif_WhenATapoAnswersOnvifAlone()
    {
        // Arrange
        var onvif = FakeOnvifCamera.Replaying(
            CapturedVariant.TapoC200,
            OnvifScenario.Discovery, OnvifScenario.GetServices, OnvifScenario.GetProfiles,
            OnvifScenario.PtzGetConfigurationOptions, OnvifScenario.PtzGetPresets, OnvifScenario.ImagingGetImagingSettings);
        var detection = DetectionOver(OnvifCamera(), onvif, Answering(SupportedProtocol.Onvif));

        // Act
        await detection.ExecuteAsync("cam1");

        // Assert
        Assert.Equal((SupportedProtocol.Onvif, CapabilityStatus.Verified), StateOf(CameraCapability.Ptz));
        Assert.Equal((SupportedProtocol.Onvif, CapabilityStatus.Verified), StateOf(CameraCapability.ImageSettings));
    }

    [Fact]
    public async Task ExecuteAsync_ShouldProvePtzOverDvripWithItsNativePresets_WhenAnIcseeAnswersDvrip()
    {
        // Arrange
        await using var dvrip = CapturedTcpCamera.Replaying(FixtureProtocol.Dvrip, CapturedVariant.Icsee, DvripScenario.PtzPresetList, DvripScenario.PtzPresetStoreAndClear);
        var detection = DetectionOver(dvrip.Camera(FixtureLoader.Neutral.Account.Password), new FakeOnvifCamera(FakeOnvifCamera.ProfileWithoutPtzXml, null), Answering(SupportedProtocol.Dvrip));

        // Act
        await detection.ExecuteAsync("cam1");

        // Assert
        Assert.Equal((SupportedProtocol.Dvrip, CapabilityStatus.Verified), StateOf(CameraCapability.Ptz));
        Assert.True(BindingConfig.ReadBool(_stored[CameraCapability.Ptz].ConfigJson, BindingConfig.SupportsNativePresets));
        Assert.Empty(dvrip.Unasked);
    }

    // ONVIF proves the V380 head by a read, yet its moves freeze the firmware (docs/hardware/v380-pro.md).
    [Fact]
    public async Task ExecuteAsync_ShouldKeepPtzToConfirmOverTheV380ProtocolWithoutTryingOnvif_WhenAV380AnswersBoth()
    {
        // Arrange
        var onvif = FakeOnvifCamera.Replaying(
            CapturedVariant.V380Pro,
            OnvifScenario.Discovery, OnvifScenario.GetServices, OnvifScenario.GetProfiles,
            OnvifScenario.PtzGetConfigurationOptions, OnvifScenario.PtzGetPresets, OnvifScenario.ImagingGetImagingSettings);
        var detection = DetectionOver(OnvifCamera(), onvif, Answering(SupportedProtocol.V380, SupportedProtocol.Onvif));

        // Act
        await detection.ExecuteAsync("cam1");

        // Assert
        Assert.Equal((SupportedProtocol.V380, CapabilityStatus.ToConfirm), StateOf(CameraCapability.Ptz));
        Assert.Equal([SupportedProtocol.V380], _ptzTries.Distinct());
        Assert.False(_stored.ContainsKey(CameraCapability.ImageSettings));
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
        _stored[CameraCapability.Ptz] = manual;
        var detection = DetectionOver(
            OnvifCamera(),
            new FakeOnvifCamera(FakeOnvifCamera.ProfileWithoutPtzXml, FakeOnvifCamera.PtzOptionsXml),
            Answering(SupportedProtocol.V380, SupportedProtocol.Onvif));

        // Act
        await detection.ExecuteAsync("cam1");

        // Assert
        Assert.Equal((SupportedProtocol.Onvif, CapabilityStatus.Missing), StateOf(CameraCapability.Ptz));
        Assert.DoesNotContain(SupportedProtocol.V380, _ptzTries);
    }

    private void Store(CameraCapabilityBinding binding)
    {
        _stored[binding.Capability] = binding;
        if (binding.Capability == CameraCapability.Ptz) _ptzTries.Add(binding.Protocol);
    }

    private (SupportedProtocol, CapabilityStatus) StateOf(CameraCapability capability)
        => (_stored[capability].Protocol, _stored[capability].Status);

    private static Camera OnvifCamera() => new()
    {
        Id = "cam1",
        Slug = "cam1",
        FrigateCameraName = "cam1",
        DisplayName = "cam1",
        Host = FixtureLoader.Neutral.CameraHost,
        Username = FixtureLoader.Neutral.Account.Username,
        Password = FixtureLoader.Neutral.Account.Password,
    };

    // The protocol level stands in: the given protocols answer with the account, the others are silent (ADR-61).
    private static ICameraProtocolProbe Answering(params SupportedProtocol[] protocols)
    {
        var probe = Substitute.For<ICameraProtocolProbe>();
        probe.ProbeAsync(Arg.Any<Camera>(), Arg.Any<SupportedProtocol>(), Arg.Any<CancellationToken>())
            .Returns(call => protocols.Contains(call.Arg<SupportedProtocol>()) ? ProtocolAnswer.Answers() : ProtocolAnswer.Unreachable("silent"));
        return probe;
    }

    // Registered ONVIF first, as the DI container does: the registry orders them, not the registration.
    private DetectCameraCapabilitiesUseCase DetectionOver(Camera camera, FakeOnvifCamera onvifPeer, ICameraProtocolProbe protocols)
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient("onvif").Returns(_ => new HttpClient(onvifPeer, disposeHandler: false));
        var resolver = new OnvifEndpointResolver(factory, TimeProvider.System, NullLogger<OnvifEndpointResolver>.Instance);
        var onvif = new OnvifClient(factory, resolver, TimeProvider.System, NullLogger<OnvifClient>.Instance);
        var runner = new PtzMoveRunner(new FakeTimeProvider(), NullLogger<PtzMoveRunner>.Instance);
        var registry = new CapabilityProviderRegistry(
            [
                new OnvifPtzProvider(onvif, runner, NullLogger<OnvifPtzProvider>.Instance),
                new DvripPtzProvider(new DvripClient(new FakeTimeProvider()), runner, NullLogger<DvripPtzProvider>.Instance),
                new V380PtzProvider(new V380Client(NullLogger<V380Client>.Instance), runner, NullLogger<V380PtzProvider>.Instance),
            ],
            [],
            // No DVRIP image settings capture yet: ONVIF stands alone for that capability here.
            [new OnvifImageSettingsProvider(onvif)]);
        return CapabilityTestUseCases.Seed(_cameras, _bindings, registry, Substitute.For<ICameraProtocolEndpointCache>(), protocols);
    }
}
