using Vyzio.Core.Entities;

namespace Vyzio.Tests.Entities;

public class CameraTests
{
    [Fact]
    public void Camera_ShouldDefaultToTheSoftwareStop_WhenNoStrategyWasChosen()
    {
        // Arrange & Act
        var camera = new Camera
        {
            Id = "cam1",
            Slug = "cam1",
            FrigateCameraName = "cam1",
            DisplayName = "Test",
            Host = "192.168.1.1",
        };

        // Assert
        Assert.Equal(PrivacyStrategy.SoftwareBlur, camera.PrivacyStrategy);
    }

    private static Camera InSurveillance() => new Camera
    {
        Id = "cam1",
        Slug = "cam1",
        FrigateCameraName = "cam1",
        DisplayName = "Test",
        Host = "192.168.1.1",
        IsEnabled = true,
        ValidationState = CameraValidationState.Validated,
    }.WithStream(SupportedProtocol.Rtsp, path: "/stream1");

    [Fact]
    public void LiveQualities_ShouldOfferTheLowQualityAlone_WhenTheCameraHasOneStream()
    {
        // Arrange
        var camera = InSurveillance();

        // Act
        var qualities = camera.LiveQualities;

        // Assert
        Assert.Equal([LiveQuality.Low], qualities);
    }

    [Fact]
    public void LiveQualities_ShouldOfferBothQualities_WhenTheSecondStreamHoldsNoRoleButWorks()
    {
        // Arrange
        var camera = InSurveillance();
        StreamLineup.Add(camera.StreamBinding!, SupportedProtocol.Rtsp, "/stream2", StreamRole.None).Verified = true;

        // Act
        var qualities = camera.LiveQualities;

        // Assert
        Assert.Equal([LiveQuality.Low, LiveQuality.High], qualities);
    }

    [Fact]
    public void LiveStream_ShouldPlayTheSmallerStreamFirst_WhenEverySizeIsKnown()
    {
        // Arrange
        var camera = InSurveillance();
        camera.Streams.First().Width = 640;
        camera.Streams.First().Height = 360;
        var main = StreamLineup.Add(camera.StreamBinding!, SupportedProtocol.Rtsp, "/stream2", StreamRole.None);
        main.Verified = true;
        main.Width = 1920;
        main.Height = 1080;

        // Act
        var low = camera.LiveStream(LiveQuality.Low);
        var high = camera.LiveStream(LiveQuality.High);

        // Assert
        Assert.Equal("/stream1", low!.Path);
        Assert.Same(main, high);
    }

    [Fact]
    public void LiveStream_ShouldTakeTheMainStreamAsHigh_WhenASizeIsUnknown()
    {
        // Arrange
        var camera = InSurveillance();
        var sub = StreamLineup.Add(camera.StreamBinding!, SupportedProtocol.Rtsp, "/stream2", StreamRole.Detect);

        // Act
        var low = camera.LiveStream(LiveQuality.Low);
        var high = camera.LiveStream(LiveQuality.High);

        // Assert
        Assert.Same(sub, low);
        Assert.Equal("/stream1", high!.Path);
    }

    [Fact]
    public void LiveQualities_ShouldOfferOneQuality_WhenTheOtherStreamHoldsNoRoleAndFailedItsCheck()
    {
        // Arrange
        var camera = InSurveillance();
        StreamLineup.Add(camera.StreamBinding!, SupportedProtocol.Rtsp, "/stream2", StreamRole.None);

        // Act
        var qualities = camera.LiveQualities;

        // Assert
        Assert.Equal([LiveQuality.Low], qualities);
    }

    [Fact]
    public void LiveStreams_ShouldKeepToTheTwoRoleStreams_WhenAThirdStreamWorksToo()
    {
        // Arrange
        var camera = InSurveillance();
        var detect = StreamLineup.Add(camera.StreamBinding!, SupportedProtocol.Rtsp, "/stream2", StreamRole.Detect);
        StreamLineup.Add(camera.StreamBinding!, SupportedProtocol.Rtsp, "/stream3", StreamRole.None).Verified = true;

        // Act
        var streams = camera.LiveStreams;

        // Assert
        Assert.Equal(["/stream2", "/stream1"], streams.Select(stream => stream.Path));
        Assert.Same(detect, camera.LiveStream(LiveQuality.Low));
    }

    [Fact]
    public void LiveQualities_ShouldOfferNone_WhenTheCameraIsNotInSurveillance()
    {
        // Arrange
        var camera = InSurveillance();
        camera.ValidationState = CameraValidationState.ToSetUp;

        // Act
        var qualities = camera.LiveQualities;

        // Assert
        Assert.Empty(qualities);
    }
}
