using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

// A DVRIP camera never confirms native presets, so its positions go through the ones Vyzio keeps (ADR-59).
public class PtzPositionsOverDvripTests
{
    private static readonly TimeSpan FullRange = TimeSpan.FromSeconds(6);

    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly IPtzCapabilityProvider _dvrip = Substitute.For<IPtzCapabilityProvider>();
    private readonly IPtzMotion _dvripMotion = Substitute.For<IPtzMotion>();
    private readonly IPtzPresetRepository _presets = Substitute.For<IPtzPresetRepository>();
    private readonly PtzManagedPositions _positions = new(TimeProvider.System, NullLogger<PtzManagedPositions>.Instance);
    private readonly Camera _camera = new() { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "192.168.1.10" };
    private readonly CameraCapabilityBinding _binding = new()
    {
        CameraId = "cam1",
        Capability = CameraCapability.Ptz,
        Protocol = SupportedProtocol.Dvrip,
        Verified = true,
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
    }

    private Task<bool> Calibrate() => new PtzCalibrateUseCase(_cameras, _bindings, _registry, _positions).ExecuteAsync("cam1");

    private Task<bool> Step(string direction) => new PtzStepUseCase(_cameras, _bindings, _registry, _positions).ExecuteAsync("cam1", new PtzMoveRequest(direction));

    private async Task<bool> IsCalibrated() => (await new GetPtzPresetsUseCase(_presets, _bindings, _positions).ExecuteAsync("cam1")).Calibrated;

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
        await Step("Right");
        await Step("Right");
        await Step("Down");

        // Act
        var saved = await new PtzSavePresetUseCase(_cameras, _bindings, _registry, _presets, _positions).ExecuteAsync("cam1", PtzPreset.SurveillanceSlot);

        // Assert
        Assert.True(saved);
        await _presets.Received(1).UpsertAsync(
            Arg.Is<PtzPreset>(p => p.PresetId == PtzPreset.SurveillanceSlot && !p.Native && p.PanMs == 200 && p.TiltMs == 100),
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
        var reached = await new PtzGoToPresetUseCase(_cameras, _bindings, _registry, _presets, _positions).ExecuteAsync("cam1", PtzPreset.ParkingSlot);

        // Assert
        Assert.True(reached);
        await _dvripMotion.Received(1).MoveForAsync(PtzDirection.Right, Arg.Any<int>(), TimeSpan.FromMilliseconds(300), Arg.Any<CancellationToken>());
        await _dvripMotion.Received(1).MoveForAsync(PtzDirection.Down, Arg.Any<int>(), TimeSpan.FromMilliseconds(100), Arg.Any<CancellationToken>());
        await _dvrip.DidNotReceive().PtzGoToPresetAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
    }
}
