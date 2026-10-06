using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
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
    private readonly IPtzMotion _ptzMotion = Substitute.For<IPtzMotion>();
    private readonly IPtzPresetRepository _presets = Substitute.For<IPtzPresetRepository>();
    private readonly ILogger<ToggleCameraPrivacyModeUseCase> _logger = Substitute.For<ILogger<ToggleCameraPrivacyModeUseCase>>();
    private readonly ILiveStreamRelay _live = Substitute.For<ILiveStreamRelay>();
    private readonly IScheduleRuleRepository _schedules = Substitute.For<IScheduleRuleRepository>();
    // 2026-09-23 is a Wednesday, inside the morning range below.
    private readonly PrivacyResumes _resumes = new(TimeZoneInfo.Utc, new FakeTimeProvider(DateTimeOffset.Parse("2026-09-23T10:30:00+00:00", System.Globalization.CultureInfo.InvariantCulture)));
    private readonly ToggleCameraPrivacyModeUseCase _sut;

    public ToggleCameraPrivacyModeUseCaseTests()
    {
        _registry.ResolvePrivacy(Arg.Any<SupportedProtocol>()).Returns(_privacyProvider);
        _registry.ResolvePtz(Arg.Any<SupportedProtocol>()).Returns(_ptzProvider);
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);
        _presets.GetAsync("cam1", Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(call => new PtzPreset { CameraId = "cam1", PresetId = call.ArgAt<int>(1) });
        _ptzProvider.ReadPresetsAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>())
            .Returns(new HashSet<int> { PtzPreset.SurveillanceSlot, PtzPreset.ParkingSlot });
        _sut = new ToggleCameraPrivacyModeUseCase(_cameras, _bindings, _registry, _frigateConfig, _presets, new PtzManagedPositions(TimeProvider.System, NullLogger<PtzManagedPositions>.Instance), _live, _schedules, _resumes, _logger);
    }

    private static ScheduleRule WednesdayMorning(string cameraId) => new()
    {
        Kind = ScheduleRuleKind.Privacy,
        DaysOfWeek = "[3]",
        StartTime = "08:00",
        EndTime = "12:00",
        Targets = [new ScheduleRuleTarget { TargetId = cameraId }],
    };

    private static Camera MakeCamera(string id = "cam1", PrivacyStrategy strategy = PrivacyStrategy.SoftwareBlur) => new()
    {
        Id = id,
        Slug = id,
        FrigateCameraName = id.Replace('-', '_'),
        DisplayName = id,
        Host = "192.168.1.10",
        PrivacyStrategy = strategy,
    };

    private const string NativePresets = """{"supports_native_presets":true}""";

    private static CameraCapabilityBinding MakeBinding(
        string cameraId, CameraCapability capability, SupportedProtocol protocol, bool verified = true, string? configJson = null) => new()
        {
            CameraId = cameraId,
            Capability = capability,
            Protocol = protocol,
            Status = verified ? CapabilityStatus.Verified : CapabilityStatus.Failed,
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

    [Theory]
    [InlineData(true, 1)]
    [InlineData(false, 0)]
    public async Task ExecuteAsync_ShouldCutTheOpenLiveViewsOnlyWhenPrivacyTurnsOn_WhenTheModeChanges(bool active, int cuts)
    {
        // Arrange
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());

        // Act
        await _sut.ExecuteAsync("cam1", active);

        // Assert
        _live.Received(cuts).Cut("cam1");
    }

    [Fact]
    public async Task ExecuteAsync_ShouldCutTheLiveViewsAfterSavingPrivacy_WhenPrivacyTurnsOn()
    {
        // Arrange
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());

        // Act
        await _sut.ExecuteAsync("cam1", active: true);

        // Assert
        Received.InOrder(() =>
        {
            _cameras.UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
            _live.Cut("cam1");
        });
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
        // Arrange
        var camera = MakeCamera(strategy: PrivacyStrategy.PtzParking);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        var ptzBinding = MakeBinding("cam1", CameraCapability.Ptz, SupportedProtocol.V380);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(ptzBinding);
        _presets.GetAsync("cam1", PtzPreset.ParkingSlot, Arg.Any<CancellationToken>())
            .Returns(new PtzPreset { CameraId = "cam1", PresetId = PtzPreset.ParkingSlot, PanMs = 200, TiltMs = 100 });
        _ptzProvider.FullRange.Returns(TimeSpan.FromMilliseconds(300));
        _ptzProvider.OpenMotionAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(_ptzMotion);
        _ptzMotion.MoveForAsync(Arg.Any<PtzDirection>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(call => call.ArgAt<TimeSpan>(2));

        // Act
        await _sut.ExecuteAsync("cam1", active: true);

        // Assert
        await _ptzMotion.Received(1).MoveForAsync(PtzDirection.UpLeft, Arg.Any<int>(), TimeSpan.FromMilliseconds(300) + PtzManagedPositions.HomingMargin, Arg.Any<CancellationToken>());
        await _ptzMotion.Received(1).MoveForAsync(PtzDirection.Right, Arg.Any<int>(), TimeSpan.FromMilliseconds(200), Arg.Any<CancellationToken>());
        await _ptzMotion.Received(1).MoveForAsync(PtzDirection.Down, Arg.Any<int>(), TimeSpan.FromMilliseconds(100), Arg.Any<CancellationToken>());
        await _ptzProvider.DidNotReceive().PtzGoToPresetAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReportTheParkingPositionMissing_WhenTheCameraHoldsNoPresetOnTheParkingSlot()
    {
        // Arrange
        var camera = MakeCamera(strategy: PrivacyStrategy.PtzParking);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>())
            .Returns(MakeBinding("cam1", CameraCapability.Ptz, SupportedProtocol.Dvrip, configJson: NativePresets));
        _presets.GetAsync("cam1", PtzPreset.ParkingSlot, Arg.Any<CancellationToken>())
            .Returns(new PtzPreset { CameraId = "cam1", PresetId = PtzPreset.ParkingSlot, PanMs = 200, TiltMs = 100 });
        _ptzProvider.ReadPresetsAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>())
            .Returns(new HashSet<int> { PtzPreset.SurveillanceSlot });

        // Act
        var result = await _sut.ExecuteAsync("cam1", active: true);

        // Assert
        Assert.Equal(PrivacyMiss.PositionMissing, camera.PrivacyMiss);
        Assert.True(result!.PrivacyModeActive);
        await _ptzProvider.DidNotReceive().PtzGoToPresetAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReportTheCameraFailedAndStayStill_WhenTheCameraCannotSayWhichPresetsItHolds()
    {
        // Arrange
        var camera = MakeCamera(strategy: PrivacyStrategy.PtzParking);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>())
            .Returns(MakeBinding("cam1", CameraCapability.Ptz, SupportedProtocol.Onvif, configJson: NativePresets));
        _ptzProvider.ReadPresetsAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<IReadOnlySet<int>>(new CameraUnreachableException("ONVIF Ptz: no answer")));

        // Act
        var result = await _sut.ExecuteAsync("cam1", active: true);

        // Assert
        Assert.Equal(PrivacyMiss.CameraFailed, camera.PrivacyMiss);
        Assert.True(result!.PrivacyModeActive);
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
        await _ptzProvider.DidNotReceive().OpenMotionAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
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

    [Fact]
    public async Task ExecuteAsync_ShouldHoldAResume_WhenTheSurveillanceIsResumedByHandInsideARange()
    {
        // Arrange
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());
        _schedules.GetByKindAsync(ScheduleRuleKind.Privacy, Arg.Any<CancellationToken>()).Returns([WednesdayMorning("cam1")]);

        // Act
        await _sut.ExecuteAsync("cam1", active: false);

        // Assert
        Assert.True(_resumes.Holds("cam1"));
    }

    [Fact]
    public async Task ExecuteAsync_ShouldHoldNoResume_WhenTheSurveillanceIsResumedOutsideAnyRange()
    {
        // Arrange
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());
        _schedules.GetByKindAsync(ScheduleRuleKind.Privacy, Arg.Any<CancellationToken>()).Returns([WednesdayMorning("cam2")]);

        // Act
        await _sut.ExecuteAsync("cam1", active: false);

        // Assert
        Assert.False(_resumes.Holds("cam1"));
    }

    [Fact]
    public async Task ExecuteAsync_ShouldHoldNoResume_WhenTheScheduleEndsPrivacy()
    {
        // Arrange
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());
        _schedules.GetByKindAsync(ScheduleRuleKind.Privacy, Arg.Any<CancellationToken>()).Returns([WednesdayMorning("cam1")]);

        // Act
        await _sut.ExecuteAsync("cam1", active: false, PrivacyModeSource.Schedule);

        // Assert
        Assert.False(_resumes.Holds("cam1"));
    }

    [Fact]
    public async Task ExecuteAsync_ShouldEndTheResume_WhenTheCameraIsCutAgain()
    {
        // Arrange
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());
        _resumes.Resume("cam1", [WednesdayMorning("cam1")]);

        // Act
        await _sut.ExecuteAsync("cam1", active: true);

        // Assert
        Assert.False(_resumes.Holds("cam1"));
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
    private readonly ILiveStreamRelay _live = Substitute.For<ILiveStreamRelay>();
    private readonly IScheduleRuleRepository _schedules = Substitute.For<IScheduleRuleRepository>();
    // 2026-09-23 is a Wednesday, inside the morning range below.
    private readonly PrivacyResumes _resumes = new(TimeZoneInfo.Utc, new FakeTimeProvider(DateTimeOffset.Parse("2026-09-23T10:30:00+00:00", System.Globalization.CultureInfo.InvariantCulture)));

    public BatchToggleCameraPrivacyModeUseCaseTests()
    {
        _registry.ResolvePrivacy(Arg.Any<SupportedProtocol>()).Returns(_privacyProvider);
        _sut = new BatchToggleCameraPrivacyModeUseCase(_cameras, _bindings, _registry, _frigateConfig, Substitute.For<IPtzPresetRepository>(), new PtzManagedPositions(TimeProvider.System, NullLogger<PtzManagedPositions>.Instance), _live, _schedules, _resumes);
    }

    private static ScheduleRule WednesdayMorning(string cameraId) => new()
    {
        Kind = ScheduleRuleKind.Privacy,
        DaysOfWeek = "[3]",
        StartTime = "08:00",
        EndTime = "12:00",
        Targets = [new ScheduleRuleTarget { TargetId = cameraId }],
    };

    [Fact]
    public async Task ExecuteAsync_ShouldHoldAResumeOnlyForTheCamerasInsideARange_WhenTheBatchResumesSurveillance()
    {
        // Arrange
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeCamera("cam1"), MakeCamera("cam2")]);
        _schedules.GetByKindAsync(ScheduleRuleKind.Privacy, Arg.Any<CancellationToken>()).Returns([WednesdayMorning("cam1")]);

        // Act
        await _sut.ExecuteAsync(["cam1", "cam2"], active: false);

        // Assert
        Assert.Equal((true, false), (_resumes.Holds("cam1"), _resumes.Holds("cam2")));
    }

    [Fact]
    public async Task ExecuteAsync_ShouldEndTheResumes_WhenTheBatchCutsTheCameras()
    {
        // Arrange
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeCamera("cam1")]);
        _resumes.Resume("cam1", [WednesdayMorning("cam1")]);

        // Act
        await _sut.ExecuteAsync(["cam1"], active: true);

        // Assert
        Assert.False(_resumes.Holds("cam1"));
    }

    private static Camera MakeCamera(string id, PrivacyStrategy strategy = PrivacyStrategy.SoftwareBlur) => new()
    {
        Id = id,
        Slug = id,
        FrigateCameraName = id.Replace('-', '_'),
        DisplayName = id,
        Host = "192.168.1.10",
        PrivacyStrategy = strategy,
    };

    [Theory]
    [InlineData(true, 1)]
    [InlineData(false, 0)]
    public async Task ExecuteAsync_ShouldCutEachCamerasOpenLiveViewsOnlyWhenPrivacyTurnsOn_WhenTheBatchChangesTheMode(bool active, int cuts)
    {
        // Arrange
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeCamera("cam1"), MakeCamera("cam2")]);

        // Act
        await _sut.ExecuteAsync(["cam1", "cam2"], active);

        // Assert
        _live.Received(cuts).Cut("cam1");
        _live.Received(cuts).Cut("cam2");
    }

    [Fact]
    public async Task ExecuteAsync_ShouldCutEachCameraAfterSavingIt_WhenTheBatchTurnsPrivacyOn()
    {
        // Arrange
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeCamera("cam1")]);

        // Act
        await _sut.ExecuteAsync(["cam1"], active: true);

        // Assert
        Received.InOrder(() =>
        {
            _cameras.UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
            _live.Cut("cam1");
        });
    }

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
                Status = CapabilityStatus.Verified,
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
                Status = CapabilityStatus.Verified,
            });

        var result = await _sut.ExecuteAsync(["cam1", "cam2"], active: true);

        Assert.Equal(2, result.Count);
        Assert.All(result, dto => Assert.True(dto.PrivacyVendorCut));
    }
}

public class SetCameraPrivacyStrategyUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly IPtzCapabilityProvider _ptzProvider = Substitute.For<IPtzCapabilityProvider>();
    private readonly IPtzPresetRepository _presets = Substitute.For<IPtzPresetRepository>();
    private readonly SetCameraPrivacyStrategyUseCase _sut;

    public SetCameraPrivacyStrategyUseCaseTests()
    {
        _registry.ResolvePtz(Arg.Any<SupportedProtocol>()).Returns(_ptzProvider);
        _presets.GetAllAsync("cam1", Arg.Any<CancellationToken>()).Returns([
            new PtzPreset { CameraId = "cam1", PresetId = PtzPreset.SurveillanceSlot },
            new PtzPreset { CameraId = "cam1", PresetId = PtzPreset.ParkingSlot },
        ]);
        _sut = new SetCameraPrivacyStrategyUseCase(_cameras, _bindings, _registry, _presets);
    }

    private static CameraCapabilityBinding NativePtzBinding() => new()
    {
        CameraId = "cam1",
        Capability = CameraCapability.Ptz,
        Protocol = SupportedProtocol.Onvif,
        Status = CapabilityStatus.Verified,
        ConfigJson = """{"supports_native_presets":true}""",
    };

    private static Camera MakeCamera() => new()
    {
        Id = "cam1",
        Slug = "cam1",
        FrigateCameraName = "cam1",
        DisplayName = "Test",
        Host = "192.168.1.1",
    };

    [Theory]
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
    public async Task ExecuteAsync_ShouldRefuseParkingAndSaveNothing_WhenOneOfItsPositionsIsNotSaved(int savedSlot)
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());
        _presets.GetAllAsync("cam1", Arg.Any<CancellationToken>()).Returns([new PtzPreset { CameraId = "cam1", PresetId = savedSlot }]);

        await Assert.ThrowsAsync<ParkingPositionsMissingException>(() =>
            _sut.ExecuteAsync("cam1", new SetPrivacyStrategyRequest("ptz_parking")));

        await _cameras.DidNotReceive().UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRefuseParking_WhenOnlyVyzioCountedItsPositionsAndTheCameraKeepsNativePresets()
    {
        // Arrange
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(NativePtzBinding());
        _ptzProvider.ReadPresetsAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>())
            .Returns(new HashSet<int>());

        // Act
        var refusal = await Record.ExceptionAsync(() => _sut.ExecuteAsync("cam1", new SetPrivacyStrategyRequest("ptz_parking")));

        // Assert
        Assert.IsType<ParkingPositionsMissingException>(refusal);
        await _cameras.DidNotReceive().UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldOfferParking_WhenTheCameraHoldsBothPresetsSavedInTheVendorApp()
    {
        // Arrange
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());
        _presets.GetAllAsync("cam1", Arg.Any<CancellationToken>()).Returns([]);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(NativePtzBinding());
        _ptzProvider.ReadPresetsAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>())
            .Returns(new HashSet<int> { PtzPreset.SurveillanceSlot, PtzPreset.ParkingSlot });

        // Act
        var result = await _sut.ExecuteAsync("cam1", new SetPrivacyStrategyRequest("ptz_parking"));

        // Assert
        Assert.Equal("ptz_parking", result!.PrivacyStrategy);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRaiseTheFailedReadAndSaveNothing_WhenTheCameraCannotSayWhichPresetsItHolds()
    {
        // Arrange
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(NativePtzBinding());
        _ptzProvider.ReadPresetsAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<IReadOnlySet<int>>(new CameraUnreachableException("ONVIF Ptz: no answer")));

        // Act
        var error = await Record.ExceptionAsync(() => _sut.ExecuteAsync("cam1", new SetPrivacyStrategyRequest("ptz_parking")));

        // Assert
        Assert.IsType<CameraUnreachableException>(error);
        await _cameras.DidNotReceive().UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepParking_WhenTheCameraAlreadyHadItWithoutItsPositions()
    {
        var camera = MakeCamera();
        camera.PrivacyStrategy = PrivacyStrategy.PtzParking;
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _presets.GetAllAsync("cam1", Arg.Any<CancellationToken>()).Returns([]);

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
    public async Task ExecuteAsync_ShouldRefuseItAndNameTheValidOnes_WhenTheStrategyIsNone()
    {
        // Arrange
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());

        // Act
        var error = await Assert.ThrowsAsync<ArgumentException>(() =>
            _sut.ExecuteAsync("cam1", new SetPrivacyStrategyRequest("none")));

        // Assert
        Assert.Contains("Valid values: software_blur, ptz_parking, hardware.", error.Message);
        await _cameras.DidNotReceive().UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReturnNull_WhenTheCameraDoesNotExist()
    {
        _cameras.GetByIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((Camera?)null);

        var result = await _sut.ExecuteAsync("unknown", new SetPrivacyStrategyRequest("software_blur"));

        Assert.Null(result);
    }
}
