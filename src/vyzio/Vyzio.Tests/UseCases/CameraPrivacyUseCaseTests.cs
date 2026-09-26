using Microsoft.Extensions.Logging;
using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class ToggleCameraPrivacyModeUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly IFrigateConfigApplier _frigateConfig = Substitute.For<IFrigateConfigApplier>();
    private readonly IPrivacyCapabilityProvider _privacyProvider = Substitute.For<IPrivacyCapabilityProvider>();
    private readonly IPtzCapabilityProvider _ptzProvider = Substitute.For<IPtzCapabilityProvider>();
    private readonly IPtzPresetRepository _presets = Substitute.For<IPtzPresetRepository>();
    private readonly ILogger<ToggleCameraPrivacyModeUseCase> _logger = Substitute.For<ILogger<ToggleCameraPrivacyModeUseCase>>();
    private readonly ToggleCameraPrivacyModeUseCase _sut;

    public ToggleCameraPrivacyModeUseCaseTests()
    {
        _registry.ResolvePrivacy(Arg.Any<SupportedProtocol>()).Returns(_privacyProvider);
        _registry.ResolvePtz(Arg.Any<SupportedProtocol>()).Returns(_ptzProvider);
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);
        _sut = new ToggleCameraPrivacyModeUseCase(_cameras, _bindings, _registry, _frigateConfig, _presets, _logger);
    }

    private static Camera MakeCamera(string id = "cam1", PrivacyStrategy strategy = PrivacyStrategy.SoftwareBlur) => new()
    {
        Id = id,
        Slug = id,
        FrigateCameraName = id.Replace('-', '_'),
        DisplayName = id,
        Host = "192.168.1.10",
        Port = 554,
        PrivacyStrategy = strategy,
    };

    private const string NativePresets = """{"supports_native_presets":true}""";

    private static CameraCapabilityBinding MakeBinding(
        string cameraId, CameraCapability capability, SupportedProtocol protocol, bool verified = true, string? configJson = null) => new()
        {
            CameraId = cameraId,
            Capability = capability,
            Protocol = protocol,
            Verified = verified,
            ConfigJson = configJson,
        };

    [Fact]
    public async Task ExecuteAsync_ShouldCutTheLensThroughThePrivacyProvider_WhenTheStrategyIsHardware()
    {
        var camera = MakeCamera(strategy: PrivacyStrategy.Hardware);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        var binding = MakeBinding("cam1", CameraCapability.HardwarePrivacy, SupportedProtocol.TapoKlap);
        _bindings.GetAsync("cam1", CameraCapability.HardwarePrivacy, Arg.Any<CancellationToken>()).Returns(binding);

        var result = await _sut.ExecuteAsync("cam1", active: true);

        Assert.NotNull(result);
        Assert.True(result!.PrivacyVendorCut);
        await _privacyProvider.Received(1).SetPrivacyModeAsync(camera, binding, true, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldStillStopRecording_WhenTheCameraRefusesTheParkingMove()
    {
        var camera = MakeCamera(strategy: PrivacyStrategy.PtzParking);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>())
            .Returns(MakeBinding("cam1", CameraCapability.Ptz, SupportedProtocol.Onvif, configJson: NativePresets));
        _ptzProvider.PtzGoToPresetAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), PtzPreset.ParkingSlot, Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new CameraCommandRefusedException("ONVIF Ptz: malformed answer")));

        var result = await _sut.ExecuteAsync("cam1", active: true);

        Assert.True(result!.PrivacyModeActive);
        await _cameras.Received(1).UpdateAsync(Arg.Is<Camera>(c => c.PrivacyModeActive), Arg.Any<CancellationToken>());
        await _frigateConfig.Received(1).ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRecordTheCameraAnswer_WhenTheCameraRefusesTheParkingMove()
    {
        var camera = MakeCamera(strategy: PrivacyStrategy.PtzParking);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>())
            .Returns(MakeBinding("cam1", CameraCapability.Ptz, SupportedProtocol.Onvif, configJson: NativePresets));
        _ptzProvider.PtzGoToPresetAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), PtzPreset.ParkingSlot, Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new CameraCommandRefusedException("ONVIF Ptz: malformed answer")));

        await _sut.ExecuteAsync("cam1", active: true);

        Assert.Equal(PrivacyMiss.CameraFailed, camera.PrivacyMiss);
        Assert.Equal("privacy on, ptz_parking: CameraCommandRefusedException: ONVIF Ptz: malformed answer", camera.PrivacyMissDetail);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldClearThePreviousMiss_WhenTheCameraFollows()
    {
        var camera = MakeCamera(strategy: PrivacyStrategy.PtzParking);
        camera.PrivacyMiss = PrivacyMiss.CameraFailed;
        camera.PrivacyMissDetail = "privacy on, ptz_parking: no answer";
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>())
            .Returns(MakeBinding("cam1", CameraCapability.Ptz, SupportedProtocol.Onvif, configJson: NativePresets));

        var result = await _sut.ExecuteAsync("cam1", active: true);

        Assert.Null(camera.PrivacyMiss);
        Assert.Null(result!.PrivacyMissDetail);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepTheDetailWithinItsColumn_WhenTheCameraAnswersAtLength()
    {
        var camera = MakeCamera(strategy: PrivacyStrategy.Hardware);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.HardwarePrivacy, Arg.Any<CancellationToken>())
            .Returns(MakeBinding("cam1", CameraCapability.HardwarePrivacy, SupportedProtocol.Dvrip));
        _privacyProvider.SetPrivacyModeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), true, Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new CameraCommandRefusedException(new string('x', 2 * Camera.PrivacyMissDetailLength))));

        await _sut.ExecuteAsync("cam1", active: true);

        Assert.Equal(Camera.PrivacyMissDetailLength, camera.PrivacyMissDetail!.Length);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldStillStopRecordingWithoutClaimingACut_WhenTheLensCutFails()
    {
        var camera = MakeCamera(strategy: PrivacyStrategy.Hardware);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.HardwarePrivacy, Arg.Any<CancellationToken>())
            .Returns(MakeBinding("cam1", CameraCapability.HardwarePrivacy, SupportedProtocol.Dvrip));
        _privacyProvider.SetPrivacyModeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), true, Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new CameraUnreachableException("DVRIP: no answer")));

        var result = await _sut.ExecuteAsync("cam1", active: true);

        Assert.True(result!.PrivacyModeActive);
        Assert.False(result.PrivacyVendorCut);
        Assert.Equal(PrivacyMiss.CameraFailed, camera.PrivacyMiss);
        await _frigateConfig.Received(1).ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRaiseAndKeepPrivacyOn_WhenTheCameraFailsToOpenTheLens()
    {
        var camera = MakeCamera(strategy: PrivacyStrategy.Hardware);
        camera.PrivacyModeActive = true;
        camera.PrivacyVendorCut = true;
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.HardwarePrivacy, Arg.Any<CancellationToken>())
            .Returns(MakeBinding("cam1", CameraCapability.HardwarePrivacy, SupportedProtocol.Dvrip));
        _privacyProvider.SetPrivacyModeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), false, Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new CameraUnreachableException("DVRIP: no answer")));

        await Assert.ThrowsAsync<CameraUnreachableException>(() => _sut.ExecuteAsync("cam1", active: false));

        Assert.True(camera.PrivacyModeActive);
        await _cameras.DidNotReceive().UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldStillApplyPrivacy_WhenTheCallerHangsUpDuringTheCameraCall()
    {
        using var caller = new CancellationTokenSource();
        var camera = MakeCamera(strategy: PrivacyStrategy.PtzParking);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>())
            .Returns(MakeBinding("cam1", CameraCapability.Ptz, SupportedProtocol.Onvif, configJson: NativePresets));
        _ptzProvider.PtzGoToPresetAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), PtzPreset.ParkingSlot, Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                caller.Cancel();
                return Task.FromException(new OperationCanceledException(caller.Token));
            });

        await _sut.ExecuteAsync("cam1", active: true, ct: caller.Token);

        Assert.Equal(PrivacyMiss.Unconfirmed, camera.PrivacyMiss);
        await _cameras.Received(1).UpdateAsync(
            Arg.Is<Camera>(c => c.PrivacyModeActive), Arg.Is<CancellationToken>(t => !t.IsCancellationRequested));
        await _frigateConfig.Received(1).ApplyAsync(
            Arg.Any<IReadOnlyList<Camera>>(), Arg.Is<CancellationToken>(t => !t.IsCancellationRequested));
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRaiseAndSaveNothing_WhenTheBindingsCannotBeRead()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera(strategy: PrivacyStrategy.Hardware));
        _bindings.GetAsync("cam1", CameraCapability.HardwarePrivacy, Arg.Any<CancellationToken>())
            .Returns(Task.FromException<CameraCapabilityBinding?>(new InvalidOperationException("database is locked")));

        await Assert.ThrowsAsync<InvalidOperationException>(() => _sut.ExecuteAsync("cam1", active: true));

        await _cameras.DidNotReceive().UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRaise_WhenNoProviderServesTheBindingProtocol()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera(strategy: PrivacyStrategy.Hardware));
        _bindings.GetAsync("cam1", CameraCapability.HardwarePrivacy, Arg.Any<CancellationToken>())
            .Returns(MakeBinding("cam1", CameraCapability.HardwarePrivacy, SupportedProtocol.Dvrip));
        _registry.ResolvePrivacy(SupportedProtocol.Dvrip).Returns(_ => throw new NotSupportedException("no DVRIP privacy provider"));

        await Assert.ThrowsAsync<NotSupportedException>(() => _sut.ExecuteAsync("cam1", active: true));

        await _cameras.DidNotReceive().UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldNotClaimALensCut_WhenTheStrategyIsSoftwareBlur()
    {
        var camera = MakeCamera(strategy: PrivacyStrategy.SoftwareBlur);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);

        var result = await _sut.ExecuteAsync("cam1", active: true);

        Assert.NotNull(result);
        Assert.False(result!.PrivacyVendorCut);
        Assert.Null(camera.PrivacyMiss);
        await _privacyProvider.DidNotReceive().SetPrivacyModeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRecordAnUnverifiedMissWithoutCutting_WhenTheHardwareBindingIsNotVerified()
    {
        var camera = MakeCamera(strategy: PrivacyStrategy.Hardware);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.HardwarePrivacy, Arg.Any<CancellationToken>())
            .Returns(MakeBinding("cam1", CameraCapability.HardwarePrivacy, SupportedProtocol.TapoKlap, verified: false));

        var result = await _sut.ExecuteAsync("cam1", active: true);

        Assert.NotNull(result);
        Assert.False(result!.PrivacyVendorCut);
        Assert.Equal(PrivacyMiss.CapabilityUnverified, camera.PrivacyMiss);
        Assert.Equal("privacy on, hardware: the hardware_privacy capability is not verified", camera.PrivacyMissDetail);
        await _privacyProvider.DidNotReceive().SetPrivacyModeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRecordNoMiss_WhenPrivacyEndsOnALensThatWasNeverVerified()
    {
        var camera = MakeCamera(strategy: PrivacyStrategy.Hardware);
        camera.PrivacyModeActive = true;
        camera.PrivacyMiss = PrivacyMiss.CapabilityUnverified;
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.HardwarePrivacy, Arg.Any<CancellationToken>())
            .Returns(MakeBinding("cam1", CameraCapability.HardwarePrivacy, SupportedProtocol.TapoKlap, verified: false));

        await _sut.ExecuteAsync("cam1", active: false);

        Assert.Null(camera.PrivacyMiss);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRecordNoMiss_WhenPrivacyEndsOnACameraWhosePtzWasNeverVerified()
    {
        var camera = MakeCamera(strategy: PrivacyStrategy.PtzParking);
        camera.PrivacyModeActive = true;
        camera.PrivacyMiss = PrivacyMiss.CapabilityUnverified;
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>())
            .Returns((CameraCapabilityBinding?)null);

        await _sut.ExecuteAsync("cam1", active: false);

        Assert.Null(camera.PrivacyMiss);
        await _ptzProvider.DidNotReceive().PtzGoToPresetAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldParkOnTheParkingSlot_WhenTheCameraKeepsItsOwnPresets()
    {
        var camera = MakeCamera(strategy: PrivacyStrategy.PtzParking);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        var ptzBinding = MakeBinding("cam1", CameraCapability.Ptz, SupportedProtocol.Onvif, configJson: NativePresets);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(ptzBinding);

        var result = await _sut.ExecuteAsync("cam1", active: true);

        Assert.NotNull(result);
        Assert.False(result!.PrivacyVendorCut);
        await _ptzProvider.Received(1).PtzGoToPresetAsync(camera, ptzBinding, PtzPreset.ParkingSlot, Arg.Any<CancellationToken>());
        await _ptzProvider.DidNotReceive().PtzGoToPresetAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), PtzPreset.SurveillanceSlot, Arg.Any<CancellationToken>());
        await _frigateConfig.Received(1).ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReplayTheSavedParkingPosition_WhenVyzioKeepsThePositions()
    {
        var camera = MakeCamera(strategy: PrivacyStrategy.PtzParking);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        var ptzBinding = MakeBinding("cam1", CameraCapability.Ptz, SupportedProtocol.V380);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(ptzBinding);
        _presets.GetAsync("cam1", PtzPreset.ParkingSlot, Arg.Any<CancellationToken>())
            .Returns(new PtzPreset { CameraId = "cam1", PresetId = PtzPreset.ParkingSlot, StepsX = 2, StepsY = 1 });
        _ptzProvider.GetVirtualPosition("cam1").Returns(((int, int)?)null);

        await _sut.ExecuteAsync("cam1", active: true);

        await _ptzProvider.Received(1).PtzHomingStepsAsync(camera, ptzBinding, Arg.Any<CancellationToken>());
        await _ptzProvider.Received(2).PtzStepAsync(camera, ptzBinding, PtzDirection.Right, Arg.Any<int>(), Arg.Any<CancellationToken>());
        await _ptzProvider.Received(1).PtzStepAsync(camera, ptzBinding, PtzDirection.Down, Arg.Any<int>(), Arg.Any<CancellationToken>());
        await _ptzProvider.DidNotReceive().PtzGoToPresetAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldStillStopRecording_WhenNoParkingPositionIsSaved()
    {
        var camera = MakeCamera(strategy: PrivacyStrategy.PtzParking);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>())
            .Returns(MakeBinding("cam1", CameraCapability.Ptz, SupportedProtocol.V380));
        _presets.GetAsync("cam1", PtzPreset.ParkingSlot, Arg.Any<CancellationToken>()).Returns((PtzPreset?)null);

        var result = await _sut.ExecuteAsync("cam1", active: true);

        Assert.True(result!.PrivacyModeActive);
        await _ptzProvider.DidNotReceive().PtzStepAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<PtzDirection>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
        await _cameras.Received(1).UpdateAsync(Arg.Is<Camera>(c => c.PrivacyModeActive), Arg.Any<CancellationToken>());
        await _frigateConfig.Received(1).ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>());
        Assert.Contains(_logger.ReceivedCalls(), call => call.GetArguments()[0] is LogLevel.Warning
            && call.GetArguments()[2]?.ToString()?.Contains("no Parking position is saved", StringComparison.Ordinal) == true);
        Assert.Equal(PrivacyMiss.PositionMissing, camera.PrivacyMiss);
        Assert.Equal("privacy on, ptz_parking: no Parking position is saved", camera.PrivacyMissDetail);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldTurnBackToSurveillance_WhenPrivacyEnds()
    {
        var camera = MakeCamera(strategy: PrivacyStrategy.PtzParking);
        camera.PrivacyModeActive = true;
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        var ptzBinding = MakeBinding("cam1", CameraCapability.Ptz, SupportedProtocol.Onvif, configJson: NativePresets);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(ptzBinding);

        await _sut.ExecuteAsync("cam1", active: false);

        await _ptzProvider.Received(1).PtzGoToPresetAsync(camera, ptzBinding, PtzPreset.SurveillanceSlot, Arg.Any<CancellationToken>());
        await _ptzProvider.DidNotReceive().PtzGoToPresetAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), PtzPreset.ParkingSlot, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldStillResumeRecording_WhenTheCameraFailsToTurnBack()
    {
        var camera = MakeCamera(strategy: PrivacyStrategy.PtzParking);
        camera.PrivacyModeActive = true;
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>())
            .Returns(MakeBinding("cam1", CameraCapability.Ptz, SupportedProtocol.Onvif, configJson: NativePresets));
        _ptzProvider.PtzGoToPresetAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), PtzPreset.SurveillanceSlot, Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new CameraUnreachableException("ONVIF Ptz: no answer")));

        var result = await _sut.ExecuteAsync("cam1", active: false);

        Assert.False(result!.PrivacyModeActive);
        Assert.Equal(PrivacyMiss.CameraFailed, camera.PrivacyMiss);
        await _cameras.Received(1).UpdateAsync(Arg.Is<Camera>(c => !c.PrivacyModeActive), Arg.Any<CancellationToken>());
        await _frigateConfig.Received(1).ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldNotMoveTheCamera_WhenItsPtzIsNotVerified()
    {
        var camera = MakeCamera(strategy: PrivacyStrategy.PtzParking);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>())
            .Returns((CameraCapabilityBinding?)null);

        await _sut.ExecuteAsync("cam1", active: true);

        await _ptzProvider.DidNotReceive().PtzGoToPresetAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
        Assert.Equal(PrivacyMiss.CapabilityUnverified, camera.PrivacyMiss);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReloadTheDetectionConfig_WhenPrivacyIsToggledInSoftware()
    {
        var camera = MakeCamera();
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);

        await _sut.ExecuteAsync("cam1", active: true);

        await _frigateConfig.Received(1).ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReturnNull_WhenTheCameraDoesNotExist()
    {
        _cameras.GetByIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((Camera?)null);

        var result = await _sut.ExecuteAsync("unknown", active: true);

        Assert.Null(result);
    }
}

public class BatchToggleCameraPrivacyModeUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly IFrigateConfigApplier _frigateConfig = Substitute.For<IFrigateConfigApplier>();
    private readonly IPrivacyCapabilityProvider _privacyProvider = Substitute.For<IPrivacyCapabilityProvider>();
    private readonly BatchToggleCameraPrivacyModeUseCase _sut;

    public BatchToggleCameraPrivacyModeUseCaseTests()
    {
        _registry.ResolvePrivacy(Arg.Any<SupportedProtocol>()).Returns(_privacyProvider);
        _sut = new BatchToggleCameraPrivacyModeUseCase(_cameras, _bindings, _registry, _frigateConfig, Substitute.For<IPtzPresetRepository>());
    }

    private static Camera MakeCamera(string id, PrivacyStrategy strategy = PrivacyStrategy.SoftwareBlur) => new()
    {
        Id = id,
        Slug = id,
        FrigateCameraName = id.Replace('-', '_'),
        DisplayName = id,
        Host = "192.168.1.10",
        Port = 554,
        PrivacyStrategy = strategy,
    };

    [Fact]
    public async Task ExecuteAsync_ShouldReloadTheDetectionConfigOnce_WhenSeveralCamerasAreToggledTogether()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns([MakeCamera("cam1"), MakeCamera("cam2")]);

        await _sut.ExecuteAsync(["cam1", "cam2"], active: true);

        await _frigateConfig.Received(1).ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldCarryOnAndReloadOnce_WhenOneCameraOfTheBatchFails()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns([MakeCamera("cam1", PrivacyStrategy.Hardware), MakeCamera("cam2", PrivacyStrategy.Hardware)]);
        _bindings.GetAsync(Arg.Any<string>(), CameraCapability.HardwarePrivacy, Arg.Any<CancellationToken>())
            .Returns(ci => new CameraCapabilityBinding
            {
                CameraId = ci.ArgAt<string>(0),
                Capability = CameraCapability.HardwarePrivacy,
                Protocol = SupportedProtocol.Dvrip,
                Verified = true,
            });
        _privacyProvider.SetPrivacyModeAsync(Arg.Is<Camera>(c => c.Id == "cam1"), Arg.Any<CameraCapabilityBinding>(), true, Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new CameraUnreachableException("DVRIP: no answer")));

        var result = await _sut.ExecuteAsync(["cam1", "cam2"], active: true);

        Assert.Equal(2, result.Count);
        Assert.All(result, camera => Assert.True(camera.PrivacyModeActive));
        await _frigateConfig.Received(1).ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>());
        await _cameras.Received(1).UpdateAsync(Arg.Is<Camera>(c => c.Id == "cam1" && c.PrivacyMiss == PrivacyMiss.CameraFailed), Arg.Any<CancellationToken>());
        await _cameras.Received(1).UpdateAsync(Arg.Is<Camera>(c => c.Id == "cam2" && c.PrivacyMiss == null), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReloadWithOnlyTheSavedCameras_WhenABindingCannotBeRead()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns([MakeCamera("cam1"), MakeCamera("cam2", PrivacyStrategy.Hardware)]);
        _bindings.GetAsync("cam2", CameraCapability.HardwarePrivacy, Arg.Any<CancellationToken>())
            .Returns(Task.FromException<CameraCapabilityBinding?>(new InvalidOperationException("database is locked")));

        await Assert.ThrowsAsync<InvalidOperationException>(() => _sut.ExecuteAsync(["cam1", "cam2"], active: true));

        await _cameras.Received(1).UpdateAsync(Arg.Is<Camera>(c => c.Id == "cam1"), Arg.Any<CancellationToken>());
        await _frigateConfig.Received(1).ApplyAsync(
            Arg.Is<IReadOnlyList<Camera>>(all => all.Single(c => c.Id == "cam1").PrivacyModeActive
                && !all.Single(c => c.Id == "cam2").PrivacyModeActive),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldCutEveryLens_WhenTheHardwareCamerasHaveAVerifiedBinding()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns([MakeCamera("cam1", PrivacyStrategy.Hardware), MakeCamera("cam2", PrivacyStrategy.Hardware)]);
        _bindings.GetAsync(Arg.Any<string>(), CameraCapability.HardwarePrivacy, Arg.Any<CancellationToken>())
            .Returns(ci => new CameraCapabilityBinding
            {
                CameraId = ci.ArgAt<string>(0),
                Capability = CameraCapability.HardwarePrivacy,
                Protocol = SupportedProtocol.TapoKlap,
                Verified = true,
            });

        var result = await _sut.ExecuteAsync(["cam1", "cam2"], active: true);

        Assert.Equal(2, result.Count);
        Assert.All(result, dto => Assert.True(dto.PrivacyVendorCut));
    }
}

public class SetCameraPrivacyStrategyUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly IPtzPresetRepository _presets = Substitute.For<IPtzPresetRepository>();
    private readonly SetCameraPrivacyStrategyUseCase _sut;

    public SetCameraPrivacyStrategyUseCaseTests()
    {
        _presets.GetAsync("cam1", PtzPreset.ParkingSlot, Arg.Any<CancellationToken>())
            .Returns(new PtzPreset { CameraId = "cam1", PresetId = PtzPreset.ParkingSlot });
        _presets.GetAsync("cam1", PtzPreset.SurveillanceSlot, Arg.Any<CancellationToken>())
            .Returns(new PtzPreset { CameraId = "cam1", PresetId = PtzPreset.SurveillanceSlot });
        _sut = new SetCameraPrivacyStrategyUseCase(_cameras, _presets);
    }

    private static Camera MakeCamera() => new()
    {
        Id = "cam1",
        Slug = "cam1",
        FrigateCameraName = "cam1",
        DisplayName = "Test",
        Host = "192.168.1.1",
    };

    [Theory]
    [InlineData("none")]
    [InlineData("software_blur")]
    [InlineData("ptz_parking")]
    [InlineData("hardware")]
    public async Task ExecuteAsync_ShouldSaveTheStrategy_WhenTheValueIsKnown(string strategy)
    {
        var camera = MakeCamera();
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);

        var result = await _sut.ExecuteAsync("cam1", new SetPrivacyStrategyRequest(strategy));

        Assert.NotNull(result);
        Assert.Equal(strategy, result!.PrivacyStrategy);
        var expectedStrategy = Vyzio.Core.Common.SnakeCaseEnum.FromSnakeCase<PrivacyStrategy>(strategy);
        await _cameras.Received(1).UpdateAsync(Arg.Is<Camera>(c => c.PrivacyStrategy == expectedStrategy), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldForgetTheLastMiss_WhenTheStrategyChanges()
    {
        var camera = MakeCamera();
        camera.PrivacyStrategy = PrivacyStrategy.Hardware;
        camera.PrivacyMiss = PrivacyMiss.CameraFailed;
        camera.PrivacyMissDetail = "privacy on, hardware: CameraUnreachableException: DVRIP: no answer";
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);

        await _sut.ExecuteAsync("cam1", new SetPrivacyStrategyRequest("software_blur"));

        Assert.Null(camera.PrivacyMiss);
        Assert.Null(camera.PrivacyMissDetail);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepTheLastMiss_WhenTheSameStrategyIsSavedAgain()
    {
        var camera = MakeCamera();
        camera.PrivacyStrategy = PrivacyStrategy.Hardware;
        camera.PrivacyMiss = PrivacyMiss.CameraFailed;
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);

        await _sut.ExecuteAsync("cam1", new SetPrivacyStrategyRequest("hardware"));

        Assert.Equal(PrivacyMiss.CameraFailed, camera.PrivacyMiss);
    }

    [Theory]
    [InlineData(PtzPreset.ParkingSlot)]
    [InlineData(PtzPreset.SurveillanceSlot)]
    public async Task ExecuteAsync_ShouldRefuseParkingAndSaveNothing_WhenOneOfItsPositionsIsNotSaved(int missingSlot)
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());
        _presets.GetAsync("cam1", missingSlot, Arg.Any<CancellationToken>()).Returns((PtzPreset?)null);

        await Assert.ThrowsAsync<ParkingPositionsMissingException>(() =>
            _sut.ExecuteAsync("cam1", new SetPrivacyStrategyRequest("ptz_parking")));

        await _cameras.DidNotReceive().UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepParking_WhenTheCameraAlreadyHadItWithoutItsPositions()
    {
        var camera = MakeCamera();
        camera.PrivacyStrategy = PrivacyStrategy.PtzParking;
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _presets.GetAsync("cam1", Arg.Any<int>(), Arg.Any<CancellationToken>()).Returns((PtzPreset?)null);

        var result = await _sut.ExecuteAsync("cam1", new SetPrivacyStrategyRequest("ptz_parking"));

        Assert.Equal("ptz_parking", result!.PrivacyStrategy);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldThrow_WhenTheStrategyIsUnknown()
    {
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _sut.ExecuteAsync("cam1", new SetPrivacyStrategyRequest("invalid_strategy")));
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReturnNull_WhenTheCameraDoesNotExist()
    {
        _cameras.GetByIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((Camera?)null);

        var result = await _sut.ExecuteAsync("unknown", new SetPrivacyStrategyRequest("software_blur"));

        Assert.Null(result);
    }
}
