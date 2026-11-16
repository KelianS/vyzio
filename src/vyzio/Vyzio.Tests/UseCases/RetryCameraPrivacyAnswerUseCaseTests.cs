using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class RetryCameraPrivacyAnswerUseCaseTests
{
    private const string NativePresets = """{"supports_native_presets":true}""";

    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly IPtzCapabilityProvider _ptzProvider = Substitute.For<IPtzCapabilityProvider>();
    private readonly IPtzPresetRepository _presets = Substitute.For<IPtzPresetRepository>();
    private readonly RetryCameraPrivacyAnswerUseCase _sut;

    public RetryCameraPrivacyAnswerUseCaseTests()
    {
        _registry.ResolvePtz(Arg.Any<SupportedProtocol>()).Returns(_ptzProvider);
        _presets.GetAsync("cam1", Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(call => new PtzPreset { CameraId = "cam1", PresetId = call.ArgAt<int>(1) });
        _ptzProvider.ReadPresetsAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>())
            .Returns(new HashSet<int> { PtzPreset.SurveillanceSlot, PtzPreset.ParkingSlot });
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(new CameraCapabilityBinding
        {
            CameraId = "cam1",
            Capability = CameraCapability.Ptz,
            Protocol = SupportedProtocol.Onvif,
            Status = CapabilityStatus.Verified,
            ConfigJson = NativePresets,
        });
        _sut = new RetryCameraPrivacyAnswerUseCase(
            _cameras, _bindings, _registry, _presets,
            new PtzManagedPositions(TimeProvider.System, NullLogger<PtzManagedPositions>.Instance));
    }

    private Camera ParkedCameraThatMissed(bool active, PrivacyMiss miss = PrivacyMiss.Unconfirmed)
    {
        var camera = new Camera
        {
            Id = "cam1",
            Slug = "cam1",
            FrigateCameraName = "cam1",
            DisplayName = "cam1",
            Host = "192.168.1.10",
            PrivacyStrategy = PrivacyStrategy.PtzParking,
            PrivacyModeActive = active,
            PrivacyModeSource = active ? PrivacyModeSource.Schedule : null,
            PrivacyMiss = miss,
            PrivacyMissDetail = "privacy on, ptz_parking: interrupted before the camera answered",
        };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        return camera;
    }

    [Fact]
    public async Task ExecuteAsync_ShouldClearTheMiss_WhenTheCameraNowReachesItsParkingPosition()
    {
        // Arrange
        var camera = ParkedCameraThatMissed(active: true);

        // Act
        var result = await _sut.ExecuteAsync("cam1");

        // Assert
        Assert.Null(result!.PrivacyMiss);
        Assert.Null(camera.PrivacyMissDetail);
        await _ptzProvider.Received(1).PtzGoToPresetAsync(camera, Arg.Any<CameraCapabilityBinding>(), PtzPreset.ParkingSlot, Arg.Any<CancellationToken>());
        await _cameras.Received(1).UpdateAsync(camera, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldSendTheCameraBackToSurveillance_WhenPrivacyIsOff()
    {
        // Arrange
        var camera = ParkedCameraThatMissed(active: false, PrivacyMiss.CameraFailed);

        // Act
        await _sut.ExecuteAsync("cam1");

        // Assert
        await _ptzProvider.Received(1).PtzGoToPresetAsync(camera, Arg.Any<CameraCapabilityBinding>(), PtzPreset.SurveillanceSlot, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRecordTheNewMiss_WhenTheCameraStillDoesNotAnswer()
    {
        // Arrange
        var camera = ParkedCameraThatMissed(active: true);
        _ptzProvider.PtzGoToPresetAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), PtzPreset.ParkingSlot, Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new CameraUnreachableException("ONVIF Ptz: no answer")));

        // Act
        await _sut.ExecuteAsync("cam1");

        // Assert
        Assert.Equal(PrivacyMiss.CameraFailed, camera.PrivacyMiss);
        Assert.Equal("privacy on, ptz_parking: CameraUnreachableException: ONVIF Ptz: no answer", camera.PrivacyMissDetail);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepPrivacyAndWhoSetIt_WhenItAsksTheCameraAgain()
    {
        // Arrange
        var camera = ParkedCameraThatMissed(active: true);

        // Act
        await _sut.ExecuteAsync("cam1");

        // Assert
        Assert.True(camera.PrivacyModeActive);
        Assert.Equal(PrivacyModeSource.Schedule, camera.PrivacyModeSource);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldAnswerNothing_WhenTheCameraDoesNotExist()
    {
        // Arrange
        _cameras.GetByIdAsync("gone", Arg.Any<CancellationToken>()).Returns((Camera?)null);

        // Act
        var result = await _sut.ExecuteAsync("gone");

        // Assert
        Assert.Null(result);
        await _cameras.DidNotReceive().UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
    }
}
