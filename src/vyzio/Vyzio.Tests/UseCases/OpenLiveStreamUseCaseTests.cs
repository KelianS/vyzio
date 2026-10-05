using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public sealed class OpenLiveStreamUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();

    private Camera Stored(Action<Camera>? change = null)
    {
        var camera = new Camera
        {
            Id = "cam1",
            Slug = "cam1",
            FrigateCameraName = "cam1",
            DisplayName = "Garden",
            Host = "192.168.1.1",
            IsEnabled = true,
            ValidationState = CameraValidationState.Validated,
        }.WithStream(SupportedProtocol.Rtsp, path: "/stream1");
        change?.Invoke(camera);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        return camera;
    }

    [Fact]
    public async Task ExecuteAsync_ShouldHandTheCameraOver_WhenItOffersTheQuality()
    {
        // Arrange
        var camera = Stored();

        // Act
        var opening = await new OpenLiveStreamUseCase(_cameras).ExecuteAsync("cam1", LiveQuality.Low);

        // Assert
        Assert.Same(camera, opening.Camera);
        Assert.Null(opening.Refusal);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRefuseAsUnknown_WhenNoCameraHasThatId()
    {
        // Arrange & Act
        var opening = await new OpenLiveStreamUseCase(_cameras).ExecuteAsync("missing", LiveQuality.Low);

        // Assert
        Assert.Equal(LiveStreamRefusal.UnknownCamera, opening.Refusal);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRefuseForPrivacy_WhenTheCameraIsInPrivacyMode()
    {
        // Arrange
        Stored(camera => camera.PrivacyModeActive = true);

        // Act
        var opening = await new OpenLiveStreamUseCase(_cameras).ExecuteAsync("cam1", LiveQuality.Low);

        // Assert
        Assert.Equal(LiveStreamRefusal.PrivacyMode, opening.Refusal);
        Assert.Null(opening.Camera);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRefuseForNoStream_WhenTheCameraHasNoSecondQuality()
    {
        // Arrange
        Stored();

        // Act
        var opening = await new OpenLiveStreamUseCase(_cameras).ExecuteAsync("cam1", LiveQuality.High);

        // Assert
        Assert.Equal(LiveStreamRefusal.NoStream, opening.Refusal);
    }
}
