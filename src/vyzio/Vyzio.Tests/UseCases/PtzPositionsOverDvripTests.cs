using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

// A DVRIP camera's positions go through its native presets once the probe confirms them, through the ones Vyzio keeps otherwise (ADR-59).
public class PtzPositionsOverDvripTests
{
    private static readonly TimeSpan FullRange = TimeSpan.FromSeconds(6);
    private const string NativePresetsConfig = """{"supports_native_presets":true}""";

    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly IPtzCapabilityProvider _dvrip = Substitute.For<IPtzCapabilityProvider>();
    private readonly IPtzMotion _dvripMotion = Substitute.For<IPtzMotion>();
    private readonly IPtzPresetRepository _presets = Substitute.For<IPtzPresetRepository>();
    private readonly IPtzThumbnailStore _thumbnails = Substitute.For<IPtzThumbnailStore>();
    private readonly PtzManagedPositions _positions = new(TimeProvider.System, NullLogger<PtzManagedPositions>.Instance);
    private readonly Camera _camera = new() { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "192.168.1.10" };
    private readonly CameraCapabilityBinding _binding = new()
    {
        CameraId = "cam1",
        Capability = CameraCapability.Ptz,
        Protocol = SupportedProtocol.Dvrip,
        Status = CapabilityStatus.Verified,
    };

    public PtzPositionsOverDvripTests()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(_camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(_binding);
        _registry.ResolvePtz(SupportedProtocol.Dvrip).Returns(_dvrip);
        _dvrip.FullRange.Returns(FullRange);
        _dvrip.OpenMotionAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(_dvripMotion);
        _dvripMotion.MoveForAsync(Arg.Any<PtzDirection>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(call => call.ArgAt<TimeSpan>(2));
        _dvripMotion.StartAsync(Arg.Any<PtzDirection>(), Arg.Any<int>(), Arg.Any<Task>(), Arg.Any<CancellationToken>()).Returns(true);
        _dvripMotion.StoppedAsync().Returns(TimeSpan.FromMilliseconds(100));
    }

    private Task<bool> Calibrate() => new PtzCalibrateUseCase(_cameras, _bindings, _registry, _positions).ExecuteAsync("cam1");

    private async Task Press(string direction)
    {
        await new PtzStartMoveUseCase(_cameras, _bindings, _registry, _positions).ExecuteAsync("cam1", new PtzMoveRequest(direction));
        await new PtzStopMoveUseCase(_positions).ExecuteAsync("cam1");
    }

    private Task<PtzSlots> ReadSlots() => new GetPtzPresetsUseCase(_cameras, _bindings, _registry, _presets, _thumbnails, _positions).ExecuteAsync("cam1");

    private async Task<bool> IsCalibrated() => (await ReadSlots()).Calibrated;

    [Fact]
    public async Task ExecuteAsync_ShouldHomeTheCameraAndReportItCalibrated_WhenItsPtzIsBoundToDvrip()
    {
        // Arrange

        // Act
        var calibrated = await Calibrate();

        // Assert
        Assert.True(calibrated);
        await _dvripMotion.Received(1).MoveForAsync(PtzDirection.UpLeft, Arg.Any<int>(), FullRange + PtzManagedPositions.HomingMargin, Arg.Any<CancellationToken>());
        Assert.True(await IsCalibrated());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRaiseTheCamerasErrorAndStayUncalibrated_WhenTheCameraRefusesTheMove()
    {
        // Arrange
        _dvripMotion.MoveForAsync(Arg.Any<PtzDirection>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new CameraCommandRefusedException("DVRIP PTZ DirectionLeftUp on 192.168.1.10: login refused or no answer."));

        // Act
        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(Calibrate);

        // Assert
        Assert.Contains("login refused", error.Message, StringComparison.Ordinal);
        Assert.False(await IsCalibrated());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldSaveTheMotionTimeCountedSinceTheCalibration_WhenTheUserSavesAPosition()
    {
        // Arrange
        await Calibrate();
        await Press("Right");
        await Press("Right");
        await Press("Down");

        // Act
        var saved = await Save(PtzPreset.SurveillanceSlot);

        // Assert
        Assert.True(saved);
        await _presets.Received(1).UpsertAsync(
            Arg.Is<PtzPreset>(p => p.PresetId == PtzPreset.SurveillanceSlot && p.PanMs == 200 && p.TiltMs == 100),
            Arg.Any<CancellationToken>());
        await _dvrip.DidNotReceive().PtzSavePresetAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldMoveEachAxisOnceBackToTheSavedPosition_WhenTheUserRecallsIt()
    {
        // Arrange
        _presets.GetAsync("cam1", PtzPreset.ParkingSlot, Arg.Any<CancellationToken>())
            .Returns(new PtzPreset { CameraId = "cam1", PresetId = PtzPreset.ParkingSlot, PanMs = 300, TiltMs = 100 });
        await Calibrate();
        _dvripMotion.ClearReceivedCalls();

        // Act
        var reached = await GoTo(PtzPreset.ParkingSlot);

        // Assert
        Assert.True(reached);
        await _dvripMotion.Received(1).MoveForAsync(PtzDirection.Right, Arg.Any<int>(), TimeSpan.FromMilliseconds(300), Arg.Any<CancellationToken>());
        await _dvripMotion.Received(1).MoveForAsync(PtzDirection.Down, Arg.Any<int>(), TimeSpan.FromMilliseconds(100), Arg.Any<CancellationToken>());
        await _dvrip.DidNotReceive().PtzGoToPresetAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldStoreThePositionInTheCameraWithoutCalibration_WhenTheCameraKeepsNativePresets()
    {
        // Arrange
        _binding.ConfigJson = NativePresetsConfig;

        // Act
        var saved = await Save(PtzPreset.SurveillanceSlot);

        // Assert
        Assert.True(saved);
        await _dvrip.Received(1).PtzSavePresetAsync(_camera, _binding, PtzPreset.SurveillanceSlot, Arg.Any<CancellationToken>());
        await _presets.DidNotReceive().UpsertAsync(Arg.Any<PtzPreset>(), Arg.Any<CancellationToken>());
        await _dvrip.DidNotReceive().OpenMotionAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRecallThePositionStoredInTheCamera_WhenTheCameraHoldsThatSlot()
    {
        // Arrange
        _binding.ConfigJson = NativePresetsConfig;
        CameraHolds(PtzPreset.ParkingSlot);

        // Act
        var reached = await GoTo(PtzPreset.ParkingSlot);

        // Assert
        Assert.True(reached);
        await _dvrip.Received(1).PtzGoToPresetAsync(_camera, _binding, PtzPreset.ParkingSlot, Arg.Any<CancellationToken>());
        await _dvrip.DidNotReceive().OpenMotionAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldAnswerNotSavedAndStayStill_WhenOnlyVyzioCountedThePositionAndTheCameraDoesNotHoldIt()
    {
        // Arrange
        _binding.ConfigJson = NativePresetsConfig;
        CameraHolds(PtzPreset.SurveillanceSlot);
        _presets.GetAsync("cam1", PtzPreset.ParkingSlot, Arg.Any<CancellationToken>())
            .Returns(new PtzPreset { CameraId = "cam1", PresetId = PtzPreset.ParkingSlot, PanMs = 300, TiltMs = 100 });

        // Act
        var reached = await GoTo(PtzPreset.ParkingSlot);

        // Assert
        Assert.False(reached);
        await _dvrip.DidNotReceive().PtzGoToPresetAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
        await _dvrip.DidNotReceive().OpenMotionAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldAnswerNotSavedAndStayStill_WhenVyzioCountsThePositionsAndNoRowHoldsTheSlot()
    {
        // Arrange
        await Calibrate();
        _dvripMotion.ClearReceivedCalls();

        // Act
        var reached = await GoTo(PtzPreset.ParkingSlot);

        // Assert
        Assert.False(reached);
        await _dvripMotion.DidNotReceive().MoveForAsync(Arg.Any<PtzDirection>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>());
        await _dvrip.DidNotReceive().ReadPresetsAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldListTheSlotsTheCameraHoldsWithoutTheRowsVyzioCounted_WhenTheCameraKeepsNativePresets()
    {
        // Arrange
        _binding.ConfigJson = NativePresetsConfig;
        CameraHolds(PtzPreset.SurveillanceSlot, PtzPreset.LastSlot + 3);
        _presets.GetAllAsync("cam1", Arg.Any<CancellationToken>()).Returns([
            new PtzPreset { CameraId = "cam1", PresetId = PtzPreset.ParkingSlot, PanMs = 300, TiltMs = 100 },
        ]);

        // Act
        var slots = await ReadSlots();

        // Assert
        Assert.Equal([PtzPreset.SurveillanceSlot], slots.Held.Select(slot => slot.PresetId));
    }

    [Fact]
    public async Task ExecuteAsync_ShouldShowAHeldSlotWithoutThumbnail_WhenTheCameraHoldsAPresetVyzioNeverCaptured()
    {
        // Arrange
        _binding.ConfigJson = NativePresetsConfig;
        CameraHolds(PtzPreset.ParkingSlot);

        // Act
        var slots = await ReadSlots();

        // Assert
        Assert.Equal(new PtzHeldSlot(PtzPreset.ParkingSlot, "Parking", Thumbnail: false), Assert.Single(slots.Held));
    }

    [Fact]
    public async Task ExecuteAsync_ShouldShowTheHeldSlotWithItsThumbnail_WhenOneWasTakenThere()
    {
        // Arrange
        _binding.ConfigJson = NativePresetsConfig;
        CameraHolds(PtzPreset.SurveillanceSlot);
        _thumbnails.ExistsAsync("cam1", PtzPreset.SurveillanceSlot, Arg.Any<CancellationToken>()).Returns(true);

        // Act
        var slots = await ReadSlots();

        // Assert
        Assert.Equal(new PtzHeldSlot(PtzPreset.SurveillanceSlot, "Surveillance", Thumbnail: true), Assert.Single(slots.Held));
    }

    [Fact]
    public async Task ExecuteAsync_ShouldDropTheThumbnailsOfTheSlotsTheCameraReadsEmpty_WhenTheCameraKeepsNativePresets()
    {
        // Arrange
        _binding.ConfigJson = NativePresetsConfig;
        CameraHolds(PtzPreset.SurveillanceSlot);

        // Act
        await ReadSlots();

        // Assert
        await _thumbnails.Received(1).DeleteAsync("cam1", PtzPreset.ParkingSlot, Arg.Any<CancellationToken>());
        await _thumbnails.DidNotReceive().DeleteAsync("cam1", PtzPreset.SurveillanceSlot, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRaiseTheFailedReadAndDropNoThumbnail_WhenTheCameraCannotSayWhichPresetsItHolds()
    {
        // Arrange
        _binding.ConfigJson = NativePresetsConfig;
        _dvrip.ReadPresetsAsync(_camera, _binding, Arg.Any<CancellationToken>())
            .ThrowsAsync(new CameraUnreachableException("DVRIP: no answer from 192.168.1.10"));

        // Act
        var error = await Record.ExceptionAsync(ReadSlots);

        // Assert
        Assert.IsType<CameraUnreachableException>(error);
        await _thumbnails.DidNotReceive().DeleteAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReportTheCameraCalibratedWithoutHoming_WhenTheCameraKeepsNativePresets()
    {
        // Arrange
        _binding.ConfigJson = NativePresetsConfig;

        // Act
        var calibrated = await IsCalibrated();

        // Assert
        Assert.True(calibrated);
        await _dvrip.DidNotReceive().OpenMotionAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    private void CameraHolds(params int[] presets)
        => _dvrip.ReadPresetsAsync(_camera, _binding, Arg.Any<CancellationToken>()).Returns(presets.ToHashSet());

    private Task<bool> Save(int presetId)
        => new PtzSavePresetUseCase(_cameras, _bindings, _registry, _presets, _thumbnails, _positions).ExecuteAsync("cam1", presetId);

    private Task<bool> GoTo(int presetId)
        => new PtzGoToPresetUseCase(_cameras, _bindings, _registry, _presets, _positions).ExecuteAsync("cam1", presetId);
}
