using NSubstitute;
using Vyzio.Core.Common;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class ProbeCameraCapabilityUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly ICameraProtocolEndpointCache _endpointCache = Substitute.For<ICameraProtocolEndpointCache>();
    private readonly IPtzCapabilityProvider _ptzProvider = Substitute.For<IPtzCapabilityProvider>();
    private readonly IPrivacyCapabilityProvider _privacyProvider = Substitute.For<IPrivacyCapabilityProvider>();
    private readonly IImageSettingsCapabilityProvider _imageSettingsProvider = Substitute.For<IImageSettingsCapabilityProvider>();
    private readonly ProbeCameraCapabilityUseCase _sut;

    public ProbeCameraCapabilityUseCaseTests()
    {
        _registry.ResolvePtz(Arg.Any<SupportedProtocol>()).Returns(_ptzProvider);
        _registry.ResolvePrivacy(Arg.Any<SupportedProtocol>()).Returns(_privacyProvider);
        _registry.ResolveImageSettings(Arg.Any<SupportedProtocol>()).Returns(_imageSettingsProvider);
        _sut = CapabilityTestUseCases.Probe(_cameras, _bindings, _registry, _endpointCache);
    }

    private static Camera MakeCamera(string id = "cam1") => new()
    {
        Id = id,
        Slug = id,
        FrigateCameraName = id.Replace('-', '_'),
        DisplayName = id,
        Host = "192.168.1.10",
    };

    private static CameraCapabilityBinding MakeBinding(CameraCapability capability, SupportedProtocol protocol = SupportedProtocol.Onvif) => new()
    {
        CameraId = "cam1",
        Capability = capability,
        Protocol = protocol,
    };

    [Fact]
    public async Task ExecuteAsync_ShouldForgetWhereTheCameraAnswered_WhenTheUserAsksForAnExplicitTest()
    {
        // The gesture after changing something on the camera: a cached address would hide the change.
        var camera = MakeCamera();
        camera.SetProtocolEndpoint(SupportedProtocol.Onvif, "http://192.168.1.10:8899/onvif/device_service");
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(MakeBinding(CameraCapability.Ptz));

        await _sut.ExecuteAsync("cam1", CameraCapability.Ptz, rediscoverEndpoints: true);

        Assert.Null(camera.GetProtocolEndpoint(SupportedProtocol.Onvif));
        _endpointCache.Received(1).Forget("cam1");
    }

    [Fact]
    public async Task ExecuteAsync_ShouldSaveTheForgottenAddress_WhenTheExplicitTestFindsNothingAgain()
    {
        // Saved, or the next load would bring the stale address back without ever sweeping.
        var camera = MakeCamera();
        camera.SetProtocolEndpoint(SupportedProtocol.Onvif, "http://192.168.1.10:8899/onvif/device_service");
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(MakeBinding(CameraCapability.Ptz));

        await _sut.ExecuteAsync("cam1", CameraCapability.Ptz, rediscoverEndpoints: true);

        await _cameras.Received(1).UpdateAsync(
            Arg.Is<Camera>(c => c.GetProtocolEndpoint(SupportedProtocol.Onvif) == null), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepWhereTheCameraAnswered_WhenTheProbeIsDrivenByTheCascade()
    {
        // The cascade forgets once for the whole run: re-resolving per candidate would re-sweep.
        var camera = MakeCamera();
        camera.SetProtocolEndpoint(SupportedProtocol.Onvif, "http://192.168.1.10:8899/onvif/device_service");
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(MakeBinding(CameraCapability.Ptz));

        await _sut.ExecuteAsync("cam1", CameraCapability.Ptz);

        Assert.NotNull(camera.GetProtocolEndpoint(SupportedProtocol.Onvif));
        _endpointCache.DidNotReceive().Forget(Arg.Any<string>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReturnNull_WhenTheCameraDoesNotExist()
    {
        _cameras.GetByIdAsync("x", Arg.Any<CancellationToken>()).Returns((Camera?)null);

        var result = await _sut.ExecuteAsync("x", CameraCapability.Ptz);

        Assert.Null(result);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldVerifyTheStream_WhenTheCapabilityIsTheStream()
    {
        // Arrange
        var camera = MakeCamera().WithStream(SupportedProtocol.Dvrip);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Stream, Arg.Any<CancellationToken>()).Returns(camera.StreamBinding);

        // Act
        var result = await _sut.ExecuteAsync("cam1", CameraCapability.Stream);

        // Assert
        Assert.Equal("stream", result!.Capability);
        Assert.Equal("dvrip", result.Protocol);
        await _bindings.Received(1).SaveAsync(camera.StreamBinding!, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReturnNull_WhenTheCameraHasNoBindingForTheCapability()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns((CameraCapabilityBinding?)null);

        var result = await _sut.ExecuteAsync("cam1", CameraCapability.Ptz);

        Assert.Null(result);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRecordThatTheProtocolAnswers_WhenTheCapabilityIsProbed()
    {
        // Arrange
        var camera = MakeCamera();
        var binding = MakeBinding(CameraCapability.ImageSettings, SupportedProtocol.Dvrip);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.ImageSettings, Arg.Any<CancellationToken>()).Returns(binding);
        _imageSettingsProvider.ProbeAsync(camera, binding, Arg.Any<CancellationToken>()).Returns(true);

        // Act
        await _sut.ExecuteAsync("cam1", CameraCapability.ImageSettings);

        // Assert
        Assert.Equal(ProtocolStatus.Answers, camera.Protocol(SupportedProtocol.Dvrip)?.Status);
        await _cameras.Received(1).UpdateAsync(camera, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldFailWithTheProtocolReasonWithoutAskingTheProvider_WhenTheProtocolDoesNotAnswer()
    {
        // Arrange
        var silent = Substitute.For<ICameraProtocolProbe>();
        silent.ProbeAsync(Arg.Any<Camera>(), SupportedProtocol.Dvrip, Arg.Any<CancellationToken>())
            .Returns(ProtocolAnswer.Unreachable("Dvrip: no answer on 192.168.1.10:34567 within 3 s."));
        var sut = CapabilityTestUseCases.Probe(_cameras, _bindings, _registry, _endpointCache, silent);
        var camera = MakeCamera();
        var binding = MakeBinding(CameraCapability.ImageSettings, SupportedProtocol.Dvrip);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.ImageSettings, Arg.Any<CancellationToken>()).Returns(binding);

        // Act
        var result = await sut.ExecuteAsync("cam1", CameraCapability.ImageSettings);

        // Assert
        Assert.False(result!.Verified);
        Assert.Equal("Dvrip: no answer on 192.168.1.10:34567 within 3 s.", result.LastError);
        await _imageSettingsProvider.DidNotReceive().ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldAskEachProtocolOnce_WhenSeveralCapabilitiesShareItInOneGesture()
    {
        // Arrange
        var answers = CapabilityTestUseCases.AnsweringProbe();
        var sut = CapabilityTestUseCases.Probe(_cameras, _bindings, _registry, _endpointCache, answers);
        var camera = MakeCamera();
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(MakeBinding(CameraCapability.Ptz));
        _bindings.GetAsync("cam1", CameraCapability.ImageSettings, Arg.Any<CancellationToken>()).Returns(MakeBinding(CameraCapability.ImageSettings));
        var run = new ProtocolCheckRun();

        // Act
        await sut.ExecuteAsync("cam1", CameraCapability.Ptz, run: run);
        await sut.ExecuteAsync("cam1", CameraCapability.ImageSettings, run: run);

        // Assert
        await answers.Received(1).ProbeAsync(camera, SupportedProtocol.Onvif, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldMarkTheBindingVerifiedAndSaveIt_WhenTheProbeSucceeds()
    {
        var camera = MakeCamera();
        var binding = MakeBinding(CameraCapability.Ptz);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(binding);
        _ptzProvider.ProbeAsync(camera, binding, Arg.Any<CancellationToken>()).Returns(true);

        var result = await _sut.ExecuteAsync("cam1", CameraCapability.Ptz);

        Assert.NotNull(result);
        Assert.True(result!.Verified);
        Assert.Null(result.LastError);
        await _bindings.Received(1).SaveAsync(Arg.Is<CameraCapabilityBinding>(b => b.Verified == true), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldMarkTheBindingUnverifiedAndSaveIt_WhenTheProbeReturnsFalse()
    {
        var camera = MakeCamera();
        var binding = MakeBinding(CameraCapability.Ptz);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(binding);
        _ptzProvider.ProbeAsync(camera, binding, Arg.Any<CancellationToken>()).Returns(false);

        var result = await _sut.ExecuteAsync("cam1", CameraCapability.Ptz);

        Assert.NotNull(result);
        Assert.False(result!.Verified);
        await _bindings.Received(1).SaveAsync(Arg.Is<CameraCapabilityBinding>(b => b.Verified == false), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldMarkTheBindingUnverifiedWithTheError_WhenTheProbeThrows()
    {
        var camera = MakeCamera();
        var binding = MakeBinding(CameraCapability.Ptz);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(binding);
        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>())
            .Returns<bool>(_ => throw new InvalidOperationException("connection refused"));

        var result = await _sut.ExecuteAsync("cam1", CameraCapability.Ptz);

        Assert.NotNull(result);
        Assert.False(result!.Verified);
        Assert.Equal("connection refused", result.LastError);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldProbeThroughThePrivacyProvider_WhenTheCapabilityIsHardwarePrivacy()
    {
        var camera = MakeCamera();
        var binding = MakeBinding(CameraCapability.HardwarePrivacy, SupportedProtocol.TapoKlap);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.HardwarePrivacy, Arg.Any<CancellationToken>()).Returns(binding);
        _privacyProvider.ProbeAsync(camera, binding, Arg.Any<CancellationToken>()).Returns(true);

        await _sut.ExecuteAsync("cam1", CameraCapability.HardwarePrivacy);

        await _privacyProvider.Received(1).ProbeAsync(camera, binding, Arg.Any<CancellationToken>());
        await _ptzProvider.DidNotReceive().ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldProbeThroughTheImageSettingsProvider_WhenTheCapabilityIsImageSettings()
    {
        var camera = MakeCamera();
        var binding = MakeBinding(CameraCapability.ImageSettings, SupportedProtocol.Onvif);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.ImageSettings, Arg.Any<CancellationToken>()).Returns(binding);
        _imageSettingsProvider.ProbeAsync(camera, binding, Arg.Any<CancellationToken>()).Returns(true);

        var result = await _sut.ExecuteAsync("cam1", CameraCapability.ImageSettings);

        Assert.NotNull(result);
        Assert.True(result!.Verified);
        await _imageSettingsProvider.Received(1).ProbeAsync(camera, binding, Arg.Any<CancellationToken>());
    }

    // ADR-28 follow-up: OnvifImageSettingsProvider now lets CameraCommandException propagate instead
    // of swallowing it — this locks in that the real reason ends up in LastError, not a generic message.
    [Fact]
    public async Task ExecuteAsync_ShouldSurfaceTheRealErrorMessage_WhenTheImageSettingsProbeThrows()
    {
        var camera = MakeCamera();
        var binding = MakeBinding(CameraCapability.ImageSettings, SupportedProtocol.Onvif);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.ImageSettings, Arg.Any<CancellationToken>()).Returns(binding);
        _imageSettingsProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>())
            .Returns<bool>(_ => throw new InvalidOperationException("La caméra a refusé la requête ONVIF imaging_service (400 Bad Request)."));

        var result = await _sut.ExecuteAsync("cam1", CameraCapability.ImageSettings);

        Assert.NotNull(result);
        Assert.False(result!.Verified);
        Assert.Equal("La caméra a refusé la requête ONVIF imaging_service (400 Bad Request).", result.LastError);
    }
}

public class ConfigureCameraCapabilityUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly ICameraProtocolEndpointCache _endpointCache = Substitute.For<ICameraProtocolEndpointCache>();
    private readonly IPtzCapabilityProvider _ptzProvider = Substitute.For<IPtzCapabilityProvider>();
    private readonly ConfigureCameraCapabilityUseCase _sut;

    public ConfigureCameraCapabilityUseCaseTests()
    {
        _registry.ResolvePtz(Arg.Any<SupportedProtocol>()).Returns(_ptzProvider);
        _registry.GetRegisteredProtocols(CameraCapability.Ptz).Returns([SupportedProtocol.Onvif, SupportedProtocol.Dvrip, SupportedProtocol.V380]);
        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(true);
        var probe = CapabilityTestUseCases.Probe(_cameras, _bindings, _registry, _endpointCache);
        _sut = new ConfigureCameraCapabilityUseCase(_cameras, _bindings, _registry, Substitute.For<IFrigateConfigApplier>(), probe);
    }

    private static Camera MakeCamera(params SupportedProtocol[] protocols)
    {
        var camera = new Camera
        {
            Id = "cam1",
            Slug = "cam1",
            FrigateCameraName = "cam1",
            DisplayName = "cam1",
            Host = "192.168.1.10",
        };
        foreach (var protocol in protocols) camera.EnsureProtocol(protocol);
        return camera;
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReturnNull_WhenTheCameraDoesNotExist()
    {
        _cameras.GetByIdAsync("x", Arg.Any<CancellationToken>()).Returns((Camera?)null);

        var result = await _sut.ExecuteAsync("x", new ConfigureCameraCapabilityRequest("ptz", "onvif"));

        Assert.Null(result);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepTheLeftRightSwap_WhenPtzIsReconfigured()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera(SupportedProtocol.Onvif));
        var existing = new CameraCapabilityBinding
        {
            CameraId = "cam1",
            Capability = CameraCapability.Ptz,
            Protocol = SupportedProtocol.V380,
            ConfigJson = """{"pan_inverted":true}""",
        };
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(existing);

        await _sut.ExecuteAsync("cam1", new ConfigureCameraCapabilityRequest("ptz", "onvif"));

        Assert.True(BindingConfig.ReadBool(existing.ConfigJson, BindingConfig.PanInverted));
    }

    [Fact]
    public async Task ExecuteAsync_ShouldThrow_WhenTheCapabilityIsUnknown()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());

        await Assert.ThrowsAsync<ArgumentException>(
            () => _sut.ExecuteAsync("cam1", new ConfigureCameraCapabilityRequest("invalid_cap", "onvif")));
    }

    [Fact]
    public async Task ExecuteAsync_ShouldSendTheCameraBackToBeChecked_WhenTheStreamMovesToAnotherProtocol()
    {
        // Arrange
        var camera = MakeCamera(SupportedProtocol.Dvrip).WithStream(SupportedProtocol.Rtsp);
        camera.ValidationState = CameraValidationState.Validated;
        camera.IsEnabled = true;
        camera.Status = "online";
        _registry.GetRegisteredProtocols(CameraCapability.Stream).Returns([SupportedProtocol.Rtsp, SupportedProtocol.Dvrip]);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Stream, Arg.Any<CancellationToken>()).Returns(camera.StreamBinding);

        // Act
        await _sut.ExecuteAsync("cam1", new ConfigureCameraCapabilityRequest("stream", "dvrip"));

        // Assert
        Assert.Equal(SupportedProtocol.Dvrip, camera.StreamBinding!.Protocol);
        Assert.Equal(CameraValidationState.Draft, camera.ValidationState);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldThrow_WhenNoProviderOfTheCapabilitySpeaksTheProtocol()
    {
        // Arrange
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());

        // Act
        var act = () => _sut.ExecuteAsync("cam1", new ConfigureCameraCapabilityRequest("ptz", "rtsp"));

        // Assert
        await Assert.ThrowsAsync<ArgumentException>(act);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRefuseWithoutSavingAnything_WhenTheCameraDoesNotHaveTheProtocol()
    {
        // Arrange
        var camera = MakeCamera(SupportedProtocol.Onvif);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);

        // Act
        var act = () => _sut.ExecuteAsync("cam1", new ConfigureCameraCapabilityRequest("ptz", "dvrip"));

        // Assert
        var refusal = await Assert.ThrowsAsync<ProtocolNotOnCameraException>(act);
        Assert.Equal(SupportedProtocol.Dvrip, refusal.Protocol);
        Assert.Null(camera.Protocol(SupportedProtocol.Dvrip));
        await _bindings.DidNotReceive().SaveAsync(Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldCreateNoProtocolRow_WhenACapabilityIsConfiguredOnOneOfTheCameraProtocols()
    {
        // Arrange
        var camera = MakeCamera(SupportedProtocol.Dvrip);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);

        // Act
        await _sut.ExecuteAsync("cam1", new ConfigureCameraCapabilityRequest("ptz", "dvrip"));

        // Assert
        Assert.Single(camera.Protocols);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldTestTheCapabilityAgain_WhenItsCurrentProtocolHasNoRow()
    {
        // Arrange
        var existing = new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Dvrip };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(existing);

        // Act
        var result = await _sut.ExecuteAsync("cam1", new ConfigureCameraCapabilityRequest("ptz", "dvrip"));

        // Assert
        Assert.Equal("dvrip", result!.Protocol);
        await _ptzProvider.Received(1).ProbeAsync(Arg.Any<Camera>(), existing, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldThrow_WhenTheProtocolIsUnknown()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());

        await Assert.ThrowsAsync<ArgumentException>(
            () => _sut.ExecuteAsync("cam1", new ConfigureCameraCapabilityRequest("ptz", "not_a_protocol")));
    }

    [Fact]
    public async Task ExecuteAsync_ShouldCreateSaveThenProbeTheBinding_WhenNoBindingExistsYet()
    {
        var camera = MakeCamera(SupportedProtocol.Onvif);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        // First GetAsync (Configure) → null; second (Probe) → the newly created binding
        var createdBinding = new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Onvif };
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>())
            .Returns((CameraCapabilityBinding?)null, createdBinding);
        _ptzProvider.ProbeAsync(camera, createdBinding, Arg.Any<CancellationToken>()).Returns(true);

        var result = await _sut.ExecuteAsync("cam1", new ConfigureCameraCapabilityRequest("ptz", "onvif"));

        Assert.NotNull(result);
        Assert.Equal("ptz", result!.Capability);
        Assert.Equal("onvif", result.Protocol);
        // SaveAsync called twice: once to create, once to update from probe result
        await _bindings.Received(2).SaveAsync(Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldSwitchTheBindingToTheNewProtocol_WhenABindingAlreadyExists()
    {
        var camera = MakeCamera(SupportedProtocol.Onvif);
        var existing = new CameraCapabilityBinding
        {
            CameraId = "cam1",
            Capability = CameraCapability.Ptz,
            Protocol = SupportedProtocol.Dvrip,
            Verified = true,
        };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        // Both calls return the same object (it gets mutated in-place by Configure)
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(existing);

        await _sut.ExecuteAsync("cam1", new ConfigureCameraCapabilityRequest("ptz", "onvif"));

        // 2 SaveAsync calls: first resets Protocol+Verified, second is from Probe
        await _bindings.Received(2).SaveAsync(Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
        // After execution, the binding protocol was changed to Onvif
        Assert.Equal(SupportedProtocol.Onvif, existing.Protocol);
    }
}

public class ProbeCameraCapabilityUseCasePtzSupportedTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly ICameraProtocolEndpointCache _endpointCache = Substitute.For<ICameraProtocolEndpointCache>();
    private readonly IPtzCapabilityProvider _ptzProvider = Substitute.For<IPtzCapabilityProvider>();
    private readonly ProbeCameraCapabilityUseCase _sut;

    public ProbeCameraCapabilityUseCasePtzSupportedTests()
    {
        _registry.ResolvePtz(Arg.Any<SupportedProtocol>()).Returns(_ptzProvider);
        _sut = CapabilityTestUseCases.Probe(_cameras, _bindings, _registry, _endpointCache);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldMarkTheCameraPtzSupported_WhenThePtzProbeSucceeds()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", PtzSupported = false };
        var binding = new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Onvif };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(binding);
        _ptzProvider.ProbeAsync(camera, binding, Arg.Any<CancellationToken>()).Returns(true);

        await _sut.ExecuteAsync("cam1", CameraCapability.Ptz);

        Assert.True(camera.PtzSupported);
        await _cameras.Received(1).UpdateAsync(Arg.Is<Camera>(c => c.PtzSupported), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldNotMarkTheCameraPtzSupported_WhenThePtzProbeFails()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", PtzSupported = false };
        var binding = new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Onvif };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(binding);
        _ptzProvider.ProbeAsync(camera, binding, Arg.Any<CancellationToken>()).Returns(false);

        await _sut.ExecuteAsync("cam1", CameraCapability.Ptz);

        Assert.False(camera.PtzSupported);
    }
}

public class SeedAndProbePresetsUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly ICameraProtocolEndpointCache _endpointCache = Substitute.For<ICameraProtocolEndpointCache>();
    private readonly IPtzCapabilityProvider _ptzProvider = Substitute.For<IPtzCapabilityProvider>();
    private readonly IPrivacyCapabilityProvider _privacyProvider = Substitute.For<IPrivacyCapabilityProvider>();
    private readonly IImageSettingsCapabilityProvider _imageSettingsProvider = Substitute.For<IImageSettingsCapabilityProvider>();
    private readonly SeedAndProbePresetsUseCase _sut;

    public SeedAndProbePresetsUseCaseTests()
    {
        _registry.ResolvePtz(Arg.Any<SupportedProtocol>()).Returns(_ptzProvider);
        _registry.ResolvePrivacy(Arg.Any<SupportedProtocol>()).Returns(_privacyProvider);
        _registry.ResolveImageSettings(Arg.Any<SupportedProtocol>()).Returns(_imageSettingsProvider);
        // Blind-probe path (unlisted camera, ADR-28): no candidates by default — tests that
        // exercise it stub the specific capability's candidate list explicitly.
        _registry.GetRegisteredProtocols(Arg.Any<CameraCapability>()).Returns([]);
        _sut = CapabilityTestUseCases.Seed(_cameras, _bindings, _registry, _endpointCache);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldSaveNoBinding_WhenTheCameraDoesNotExist()
    {
        _cameras.GetByIdAsync("x", Arg.Any<CancellationToken>()).Returns((Camera?)null);

        await _sut.ExecuteAsync("x");

        await _bindings.DidNotReceive().SaveAsync(Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldForgetWhereTheCameraAnsweredOnce_WhenDetectingEveryCapability()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = VendorFamily.TplinkTapo };
        camera.SetProtocolEndpoint(SupportedProtocol.Onvif, "http://h:8899/onvif/device_service");
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", Arg.Any<CameraCapability>(), Arg.Any<CancellationToken>()).Returns((CameraCapabilityBinding?)null);

        await _sut.ExecuteAsync("cam1");

        Assert.Null(camera.GetProtocolEndpoint(SupportedProtocol.Onvif));
        _endpointCache.Received(1).Forget("cam1");
    }

    [Fact]
    public async Task ExecuteAsync_ShouldSeedAndProbeEveryPresetBinding_WhenTheVendorIsKnown()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = VendorFamily.TplinkTapo };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", Arg.Any<CameraCapability>(), Arg.Any<CancellationToken>()).Returns((CameraCapabilityBinding?)null);
        // After SaveAsync, GetAsync returns the saved binding for the probe step
        _bindings.GetAsync("cam1", CameraCapability.HardwarePrivacy, Arg.Any<CancellationToken>())
            .Returns((CameraCapabilityBinding?)null,
                     new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.HardwarePrivacy, Protocol = SupportedProtocol.TapoKlap });
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>())
            .Returns((CameraCapabilityBinding?)null,
                     new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Onvif });
        _bindings.GetAsync("cam1", CameraCapability.ImageSettings, Arg.Any<CancellationToken>())
            .Returns((CameraCapabilityBinding?)null,
                     new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.ImageSettings, Protocol = SupportedProtocol.Onvif });
        _privacyProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(true);
        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(true);
        _imageSettingsProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(true);

        await _sut.ExecuteAsync("cam1");

        // Three preset bindings: one SaveAsync each to create, one each to persist the probe result
        await _bindings.Received(6).SaveAsync(Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRemoveTheTentativePtzBinding_WhenNoBlindCandidateVerifiesOnAnUnlistedCamera()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = null };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _registry.GetRegisteredProtocols(CameraCapability.Ptz).Returns([SupportedProtocol.Onvif]);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>())
            .Returns((CameraCapabilityBinding?)null,
                     new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Onvif });
        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(false);

        await _sut.ExecuteAsync("cam1");

        // 1 SaveAsync to create tentative binding + 1 from ProbeCameraCapabilityUseCase persisting probe result
        await _bindings.Received(2).SaveAsync(Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
        await _bindings.Received(1).DeleteAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepThePtzBinding_WhenABlindCandidateVerifiesOnAnUnlistedCamera()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = null, PtzSupported = false };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _registry.GetRegisteredProtocols(CameraCapability.Ptz).Returns([SupportedProtocol.Onvif]);
        var tentativeBinding = new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Onvif };
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>())
            .Returns((CameraCapabilityBinding?)null, tentativeBinding);
        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(true);

        await _sut.ExecuteAsync("cam1");

        await _bindings.DidNotReceive().DeleteAsync(Arg.Any<string>(), Arg.Any<CameraCapability>(), Arg.Any<CancellationToken>());
        Assert.True(camera.PtzSupported);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldTryEveryRegisteredProtocolInOrder_WhenTheCameraIsUnlisted()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = null };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _registry.GetRegisteredProtocols(CameraCapability.Ptz).Returns([SupportedProtocol.Onvif, SupportedProtocol.Dvrip, SupportedProtocol.TapoKlap]);

        CameraCapabilityBinding? stored = null;
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(_ => stored);
        _bindings.When(b => b.SaveAsync(Arg.Is<CameraCapabilityBinding>(x => x.Capability == CameraCapability.Ptz), Arg.Any<CancellationToken>()))
            .Do(call => stored = call.Arg<CameraCapabilityBinding>());

        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Is<CameraCapabilityBinding>(b => b.Protocol == SupportedProtocol.Onvif), Arg.Any<CancellationToken>())
            .Returns(false);
        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Is<CameraCapabilityBinding>(b => b.Protocol == SupportedProtocol.Dvrip), Arg.Any<CancellationToken>())
            .Returns(false);
        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Is<CameraCapabilityBinding>(b => b.Protocol == SupportedProtocol.TapoKlap), Arg.Any<CancellationToken>())
            .Returns(true);

        await _sut.ExecuteAsync("cam1");

        Assert.NotNull(stored);
        Assert.Equal(SupportedProtocol.TapoKlap, stored!.Protocol);
        Assert.True(stored.Verified);
        await _bindings.DidNotReceive().DeleteAsync(Arg.Any<string>(), Arg.Any<CameraCapability>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldBlindProbeImageSettingsAndHardwarePrivacyToo_WhenTheCameraIsUnlisted()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = null };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _registry.GetRegisteredProtocols(CameraCapability.ImageSettings).Returns([SupportedProtocol.Onvif]);
        _registry.GetRegisteredProtocols(CameraCapability.HardwarePrivacy).Returns([SupportedProtocol.TapoKlap]);
        // Sequence: first GetAsync call is the cascade loop's own lookup (nothing yet), second
        // is ProbeCameraCapabilityUseCase re-fetching the binding it must probe.
        _bindings.GetAsync("cam1", CameraCapability.ImageSettings, Arg.Any<CancellationToken>())
            .Returns((CameraCapabilityBinding?)null,
                     new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.ImageSettings, Protocol = SupportedProtocol.Onvif });
        _bindings.GetAsync("cam1", CameraCapability.HardwarePrivacy, Arg.Any<CancellationToken>())
            .Returns((CameraCapabilityBinding?)null,
                     new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.HardwarePrivacy, Protocol = SupportedProtocol.TapoKlap });
        _imageSettingsProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(true);
        _privacyProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(true);

        await _sut.ExecuteAsync("cam1");

        await _imageSettingsProvider.Received(1).ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
        await _privacyProvider.Received(1).ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldProbeNothing_WhenNoProtocolIsRegisteredForAnUnlistedCamera()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = null };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        // Default stub already returns [] for every capability — nothing should be probed at all.

        await _sut.ExecuteAsync("cam1");

        await _bindings.DidNotReceive().SaveAsync(Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    // ADR-28: Icsee declares Ptz candidates [Onvif, Dvrip] in priority order — cascade must
    // try Onvif first and fall back to Dvrip only if Onvif fails to verify.
    [Fact]
    public async Task ExecuteAsync_ShouldCascadeToTheNextCandidateProtocol_WhenTheFirstFailsToVerify()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = VendorFamily.Icsee };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);

        CameraCapabilityBinding? stored = null;
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(_ => stored);
        _bindings.When(b => b.SaveAsync(Arg.Is<CameraCapabilityBinding>(x => x.Capability == CameraCapability.Ptz), Arg.Any<CancellationToken>()))
            .Do(call => stored = call.Arg<CameraCapabilityBinding>());

        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Is<CameraCapabilityBinding>(b => b.Protocol == SupportedProtocol.Onvif), Arg.Any<CancellationToken>())
            .Returns(false);
        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Is<CameraCapabilityBinding>(b => b.Protocol == SupportedProtocol.Dvrip), Arg.Any<CancellationToken>())
            .Returns(true);

        await _sut.ExecuteAsync("cam1");

        Assert.NotNull(stored);
        Assert.Equal(SupportedProtocol.Dvrip, stored!.Protocol);
        Assert.True(stored.Verified);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldNeverChangeTheProtocol_WhenTheBindingWasConfiguredManually()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = VendorFamily.Icsee };
        var manual = new CameraCapabilityBinding
        {
            CameraId = "cam1",
            Capability = CameraCapability.Ptz,
            Protocol = SupportedProtocol.Onvif,
            Verified = false,
            ManuallyConfigured = true,
        };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(manual);
        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(false);

        await _sut.ExecuteAsync("cam1");

        // Only the probe's own persistence of the (still-failing) result — the cascade loop
        // must never re-save with a different protocol for a manually configured binding.
        await _bindings.Received(1).SaveAsync(Arg.Is<CameraCapabilityBinding>(b => b.Capability == CameraCapability.Ptz), Arg.Any<CancellationToken>());
        Assert.Equal(SupportedProtocol.Onvif, manual.Protocol);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldAskEachCandidateProtocolOnce_WhenSeveralCapabilitiesNameIt()
    {
        // Arrange
        var answers = CapabilityTestUseCases.AnsweringProbe();
        var sut = CapabilityTestUseCases.Seed(_cameras, _bindings, _registry, _endpointCache, answers);
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = VendorFamily.TplinkTapo };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);

        // Act
        await sut.ExecuteAsync("cam1");

        // Assert
        await answers.Received(1).ProbeAsync(camera, SupportedProtocol.Onvif, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldSkipACandidateThatDoesNotAnswer_WhenTheNextOneDoes()
    {
        // Arrange
        var answers = Substitute.For<ICameraProtocolProbe>();
        answers.ProbeAsync(Arg.Any<Camera>(), SupportedProtocol.Onvif, Arg.Any<CancellationToken>()).Returns(ProtocolAnswer.Unreachable("No ONVIF service answered on h."));
        answers.ProbeAsync(Arg.Any<Camera>(), SupportedProtocol.Dvrip, Arg.Any<CancellationToken>()).Returns(ProtocolAnswer.Answers());
        var sut = CapabilityTestUseCases.Seed(_cameras, _bindings, _registry, _endpointCache, answers);
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = VendorFamily.Icsee };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        CameraCapabilityBinding? stored = null;
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(_ => stored);
        _bindings.When(b => b.SaveAsync(Arg.Is<CameraCapabilityBinding>(x => x.Capability == CameraCapability.Ptz), Arg.Any<CancellationToken>()))
            .Do(call => stored = call.Arg<CameraCapabilityBinding>());
        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(true);

        // Act
        await sut.ExecuteAsync("cam1");

        // Assert
        Assert.Equal(SupportedProtocol.Dvrip, stored!.Protocol);
        await _ptzProvider.Received(1).ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldCreateTheAnsweringRowsAndBindTheStreamAndCapabilities_WhenTheCameraHasNoProtocol()
    {
        // Arrange
        var answers = Substitute.For<ICameraProtocolProbe>();
        answers.ProbeAsync(Arg.Any<Camera>(), Arg.Any<SupportedProtocol>(), Arg.Any<CancellationToken>()).Returns(ProtocolAnswer.Unreachable("silent"));
        answers.ProbeAsync(Arg.Any<Camera>(), SupportedProtocol.Dvrip, Arg.Any<CancellationToken>()).Returns(ProtocolAnswer.Answers());
        _registry.GetRegisteredProtocols(CameraCapability.Stream).Returns([SupportedProtocol.Rtsp, SupportedProtocol.Dvrip]);
        var sut = CapabilityTestUseCases.Seed(_cameras, _bindings, _registry, _endpointCache, answers);
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = VendorFamily.Icsee };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        var stored = new Dictionary<CameraCapability, CameraCapabilityBinding>();
        _bindings.GetAsync("cam1", Arg.Any<CameraCapability>(), Arg.Any<CancellationToken>())
            .Returns(call => stored.GetValueOrDefault(call.Arg<CameraCapability>()));
        _bindings.When(b => b.SaveAsync(Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()))
            .Do(call => stored[call.Arg<CameraCapabilityBinding>().Capability] = call.Arg<CameraCapabilityBinding>());
        _bindings.GetByCameraAsync("cam1", Arg.Any<CancellationToken>()).Returns(_ => stored.Values.ToList());
        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(true);

        // Act
        await sut.ExecuteAsync("cam1");

        // Assert
        Assert.Equal(SupportedProtocol.Dvrip, stored[CameraCapability.Stream].Protocol);
        Assert.True(stored[CameraCapability.Stream].Verified);
        Assert.Equal(SupportedProtocol.Dvrip, stored[CameraCapability.Ptz].Protocol);
        Assert.Equal([SupportedProtocol.Dvrip], camera.Protocols.Select(entry => entry.Protocol));
    }

    [Fact]
    public async Task ExecuteAsync_ShouldBindTheStreamToRtspFirst_WhenBothStreamProtocolsAnswer()
    {
        // Arrange
        _registry.GetRegisteredProtocols(CameraCapability.Stream).Returns([SupportedProtocol.Rtsp, SupportedProtocol.Dvrip]);
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h" };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        CameraCapabilityBinding? stream = null;
        _bindings.GetAsync("cam1", CameraCapability.Stream, Arg.Any<CancellationToken>()).Returns(_ => stream);
        _bindings.When(b => b.SaveAsync(Arg.Is<CameraCapabilityBinding>(x => x.Capability == CameraCapability.Stream), Arg.Any<CancellationToken>()))
            .Do(call => stream = call.Arg<CameraCapabilityBinding>());
        _bindings.GetByCameraAsync("cam1", Arg.Any<CancellationToken>()).Returns([]);

        // Act
        await _sut.ExecuteAsync("cam1");

        // Assert
        Assert.Equal(SupportedProtocol.Rtsp, stream!.Protocol);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepTheStreamOnTheFirstAnsweringProtocol_WhenNoStreamCheckPasses()
    {
        // Arrange
        var verifier = Substitute.For<ICameraVerifier>();
        verifier.VerifyAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>())
            .Returns(new CameraVerificationResult(true, false, "needs_attention", "No image.", DateTimeOffset.UnixEpoch, null));
        _registry.GetRegisteredProtocols(CameraCapability.Stream).Returns([SupportedProtocol.Rtsp, SupportedProtocol.Dvrip]);
        var sut = CapabilityTestUseCases.Seed(_cameras, _bindings, _registry, _endpointCache, verifier: verifier);
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h" };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        CameraCapabilityBinding? stream = null;
        _bindings.GetAsync("cam1", CameraCapability.Stream, Arg.Any<CancellationToken>()).Returns(_ => stream);
        _bindings.When(b => b.SaveAsync(Arg.Is<CameraCapabilityBinding>(x => x.Capability == CameraCapability.Stream), Arg.Any<CancellationToken>()))
            .Do(call => stream = call.Arg<CameraCapabilityBinding>());
        _bindings.GetByCameraAsync("cam1", Arg.Any<CancellationToken>()).Returns([]);

        // Act
        await sut.ExecuteAsync("cam1");

        // Assert
        Assert.Equal(SupportedProtocol.Rtsp, stream!.Protocol);
        Assert.False(stream.Verified);
        Assert.Equal("No image.", stream.LastError);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldLeaveTheStreamToConfigure_WhenNoStreamProtocolAnswers()
    {
        // Arrange
        var answers = Substitute.For<ICameraProtocolProbe>();
        answers.ProbeAsync(Arg.Any<Camera>(), Arg.Any<SupportedProtocol>(), Arg.Any<CancellationToken>()).Returns(ProtocolAnswer.Unreachable("silent"));
        _registry.GetRegisteredProtocols(CameraCapability.Stream).Returns([SupportedProtocol.Rtsp, SupportedProtocol.Dvrip]);
        var sut = CapabilityTestUseCases.Seed(_cameras, _bindings, _registry, _endpointCache, answers);
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h" };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetByCameraAsync("cam1", Arg.Any<CancellationToken>()).Returns([]);

        // Act
        await sut.ExecuteAsync("cam1");

        // Assert
        await _bindings.DidNotReceive().SaveAsync(Arg.Is<CameraCapabilityBinding>(x => x.Capability == CameraCapability.Stream), Arg.Any<CancellationToken>());
        Assert.Empty(camera.Protocols);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldNeverMoveTheStream_WhenTheCameraAlreadyHasOne()
    {
        // Arrange
        var answers = CapabilityTestUseCases.AnsweringProbe();
        _registry.GetRegisteredProtocols(CameraCapability.Stream).Returns([SupportedProtocol.Rtsp, SupportedProtocol.Dvrip]);
        var sut = CapabilityTestUseCases.Seed(_cameras, _bindings, _registry, _endpointCache, answers);
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h" }.WithStream(SupportedProtocol.Dvrip);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Stream, Arg.Any<CancellationToken>()).Returns(camera.StreamBinding);
        _bindings.GetByCameraAsync("cam1", Arg.Any<CancellationToken>()).Returns([camera.StreamBinding!]);

        // Act
        await sut.ExecuteAsync("cam1");

        // Assert
        await _bindings.DidNotReceive().SaveAsync(Arg.Is<CameraCapabilityBinding>(x => x.Capability == CameraCapability.Stream), Arg.Any<CancellationToken>());
        Assert.Equal(SupportedProtocol.Dvrip, camera.StreamBinding!.Protocol);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldDropAProtocolThatDidNotAnswer_WhenNoCapabilityUsesIt()
    {
        // Arrange
        var answers = Substitute.For<ICameraProtocolProbe>();
        answers.ProbeAsync(Arg.Any<Camera>(), Arg.Any<SupportedProtocol>(), Arg.Any<CancellationToken>()).Returns(ProtocolAnswer.Unreachable("silent"));
        var sut = CapabilityTestUseCases.Seed(_cameras, _bindings, _registry, _endpointCache, answers);
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = null };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _registry.GetRegisteredProtocols(CameraCapability.Ptz).Returns([SupportedProtocol.V380]);
        _bindings.GetByCameraAsync("cam1", Arg.Any<CancellationToken>()).Returns([]);

        // Act
        await sut.ExecuteAsync("cam1");

        // Assert
        Assert.Null(camera.Protocol(SupportedProtocol.V380));
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepASilentProtocol_WhenItHoldsWhatTheUserEntered()
    {
        // Arrange
        var answers = Substitute.For<ICameraProtocolProbe>();
        answers.ProbeAsync(Arg.Any<Camera>(), Arg.Any<SupportedProtocol>(), Arg.Any<CancellationToken>()).Returns(ProtocolAnswer.Unreachable("silent"));
        var sut = CapabilityTestUseCases.Seed(_cameras, _bindings, _registry, _endpointCache, answers);
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = null };
        camera.EnsureProtocol(SupportedProtocol.V380).DeviceId = 26970853;
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _registry.GetRegisteredProtocols(CameraCapability.Ptz).Returns([SupportedProtocol.V380]);
        _bindings.GetByCameraAsync("cam1", Arg.Any<CancellationToken>()).Returns([]);

        // Act
        await sut.ExecuteAsync("cam1");

        // Assert
        Assert.NotNull(camera.Protocol(SupportedProtocol.V380));
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepTheVerifiedProtocol_WhenThePresetStillCoversIt()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = VendorFamily.Icsee };
        var verified = new CameraCapabilityBinding
        {
            CameraId = "cam1",
            Capability = CameraCapability.Ptz,
            Protocol = SupportedProtocol.Dvrip,
            Verified = true,
        };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(verified);
        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(true);

        await _sut.ExecuteAsync("cam1");

        Assert.Equal(SupportedProtocol.Dvrip, verified.Protocol);
    }
}

public class GetCameraCapabilitiesUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly GetCameraCapabilitiesUseCase _sut;

    public GetCameraCapabilitiesUseCaseTests()
    {
        var registry = Substitute.For<ICapabilityProviderRegistry>();
        registry.GetRegisteredProtocols(CameraCapability.Stream).Returns([SupportedProtocol.Rtsp, SupportedProtocol.Dvrip]);
        _sut = new GetCameraCapabilitiesUseCase(_cameras, _bindings, registry);
    }

    private static Camera MakeCamera(string id = "cam1", VendorFamily? vendorFamily = null) => new()
    {
        Id = id,
        Slug = id,
        FrigateCameraName = id.Replace('-', '_'),
        DisplayName = id,
        Host = "h",
        VendorFamily = vendorFamily,
    };

    [Fact]
    public async Task ExecuteAsync_ShouldReturnNull_WhenTheCameraDoesNotExist()
    {
        _cameras.GetByIdAsync("x", Arg.Any<CancellationToken>()).Returns((Camera?)null);

        var result = await _sut.ExecuteAsync("x");

        Assert.Null(result);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldListTheStreamToConfigure_WhenTheCameraHasNoBindingAndNoVendor()
    {
        // Arrange
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());
        _bindings.GetByCameraAsync("cam1", Arg.Any<CancellationToken>()).Returns([]);

        // Act
        var result = await _sut.ExecuteAsync("cam1");

        // Assert
        var stream = Assert.Single(result!);
        Assert.Equal("stream", stream.Capability);
        Assert.False(stream.IsConfigured);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldListTheStreamFirstWithItsMainPath_WhenTheCameraHasOne()
    {
        // Arrange
        var camera = MakeCamera().WithStream(SupportedProtocol.Rtsp, path: "/stream1");
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetByCameraAsync("cam1", Arg.Any<CancellationToken>()).Returns([
            new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Onvif },
            camera.StreamBinding!,
        ]);

        // Act
        var result = await _sut.ExecuteAsync("cam1");

        // Assert
        Assert.Equal("stream", result![0].Capability);
        Assert.Equal("/stream1", result[0].StreamPath);
        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldMapBindingsAsConfiguredAndNotPreset_WhenTheCameraHasNoVendor()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());
        _bindings.GetByCameraAsync("cam1", Arg.Any<CancellationToken>()).Returns([
            new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Onvif, Verified = true },
            new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.HardwarePrivacy, Protocol = SupportedProtocol.TapoKlap, Verified = false },
        ]);

        var result = await _sut.ExecuteAsync("cam1");

        Assert.Equal(3, result!.Count);
        Assert.Contains(result, b => b.Capability == "ptz" && b.Protocol == "onvif" && b.Verified && !b.IsPreset && b.IsConfigured);
        Assert.Contains(result, b => b.Capability == "hardware_privacy" && b.Protocol == "tapo_klap" && !b.Verified && !b.IsPreset && b.IsConfigured);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldIncludeThePresetSuggestions_WhenNoBindingExistsYet()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera(vendorFamily: VendorFamily.TplinkTapo));
        _bindings.GetByCameraAsync("cam1", Arg.Any<CancellationToken>()).Returns([]);

        var result = await _sut.ExecuteAsync("cam1");

        // The stream, then the TplinkTapo preset: Ptz/Onvif + ImageSettings/Onvif + HardwarePrivacy/TapoKlap (ADR-56)
        Assert.Equal(4, result!.Count);
        Assert.Contains(result, b => b.Capability == "hardware_privacy" && b.Protocol == "tapo_klap" && b.IsPreset && !b.IsConfigured && !b.Verified);
        Assert.Contains(result, b => b.Capability == "ptz" && b.Protocol == "onvif" && b.IsPreset && !b.IsConfigured && !b.Verified);
        Assert.Contains(result, b => b.Capability == "image_settings" && b.Protocol == "onvif" && b.IsPreset && !b.IsConfigured && !b.Verified);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldMarkAnExistingBindingAsPreset_WhenTheVendorPresetListsIt()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera(vendorFamily: VendorFamily.TplinkTapo));
        _bindings.GetByCameraAsync("cam1", Arg.Any<CancellationToken>()).Returns([
            new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.HardwarePrivacy, Protocol = SupportedProtocol.TapoKlap, Verified = true },
        ]);

        var result = await _sut.ExecuteAsync("cam1");

        // The stream; Ptz and ImageSettings unconfigured give preset entries; HardwarePrivacy configured is both.
        Assert.Equal(4, result!.Count);
        var privacyDto = result.First(b => b.Capability == "hardware_privacy");
        Assert.True(privacyDto.IsPreset);
        Assert.True(privacyDto.IsConfigured);
        Assert.True(privacyDto.Verified);
        var ptzDto = result.First(b => b.Capability == "ptz");
        Assert.True(ptzDto.IsPreset);
        Assert.False(ptzDto.IsConfigured);
    }
}

public class RemoveCameraCapabilityUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly RemoveCameraCapabilityUseCase _sut;

    public RemoveCameraCapabilityUseCaseTests()
    {
        _sut = new RemoveCameraCapabilityUseCase(_cameras, _bindings);
    }

    private static Camera MakeCamera(string id = "cam1") => new()
    {
        Id = id,
        Slug = id,
        FrigateCameraName = id.Replace('-', '_'),
        DisplayName = id,
        Host = "192.168.1.10",
    };

    [Fact]
    public async Task ExecuteAsync_ShouldRefuse_WhenTheCapabilityIsTheStream()
    {
        // Arrange
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());

        // Act
        var act = () => _sut.ExecuteAsync("cam1", CameraCapability.Stream);

        // Assert
        await Assert.ThrowsAsync<ArgumentException>(act);
        await _bindings.DidNotReceive().DeleteAsync(Arg.Any<string>(), Arg.Any<CameraCapability>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReturnFalse_WhenTheCameraDoesNotExist()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns((Camera?)null);

        var result = await _sut.ExecuteAsync("cam1", CameraCapability.ImageSettings);

        Assert.False(result);
        await _bindings.DidNotReceive().DeleteAsync(Arg.Any<string>(), Arg.Any<CameraCapability>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReturnFalse_WhenTheCameraHasNoBindingForTheCapability()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());
        _bindings.GetAsync("cam1", CameraCapability.ImageSettings, Arg.Any<CancellationToken>()).Returns((CameraCapabilityBinding?)null);

        var result = await _sut.ExecuteAsync("cam1", CameraCapability.ImageSettings);

        Assert.False(result);
        await _bindings.DidNotReceive().DeleteAsync(Arg.Any<string>(), Arg.Any<CameraCapability>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldDeleteTheBindingAndReturnTrue_WhenTheBindingExists()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());
        _bindings.GetAsync("cam1", CameraCapability.ImageSettings, Arg.Any<CancellationToken>())
            .Returns(new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.ImageSettings, Protocol = SupportedProtocol.Onvif });

        var result = await _sut.ExecuteAsync("cam1", CameraCapability.ImageSettings);

        Assert.True(result);
        await _bindings.Received(1).DeleteAsync("cam1", CameraCapability.ImageSettings, Arg.Any<CancellationToken>());
    }
}
