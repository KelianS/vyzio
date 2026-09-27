using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.Entities;

public class StreamLineupTests
{
    private static Camera MakeCamera() => new Camera
    {
        Slug = "porch",
        FrigateCameraName = "porch",
        DisplayName = "Porch",
        Host = "192.168.1.20",
    }.WithStream(SupportedProtocol.Rtsp, path: "/stream1");

    [Fact]
    public void SetRole_ShouldTakeRecordingFromTheMainStream_WhenAnotherStreamIsGivenIt()
    {
        // Arrange
        var camera = MakeCamera();
        var sub = StreamLineup.Add(camera.StreamBinding!, SupportedProtocol.Rtsp, "/stream2", StreamRole.None);

        // Act
        var change = StreamLineup.SetRole(camera.StreamBinding!, sub, StreamRole.Record);

        // Assert
        Assert.Equal(StreamChange.Done, change);
        Assert.Equal(StreamRole.Detect, camera.MainStream!.Role);
        Assert.Same(sub, camera.RecordStream);
    }

    [Fact]
    public void SetRole_ShouldRefuse_WhenTheRecordingStreamWouldStopRecording()
    {
        // Arrange
        var camera = MakeCamera();

        // Act
        var change = StreamLineup.SetRole(camera.StreamBinding!, camera.MainStream!, StreamRole.Detect);

        // Assert
        Assert.Equal(StreamChange.StreamRecords, change);
        Assert.Equal(StreamRole.RecordAndDetect, camera.MainStream!.Role);
    }

    [Fact]
    public void SetRole_ShouldRefuse_WhenTheStreamIsDisabled()
    {
        // Arrange
        var camera = MakeCamera();
        var sub = StreamLineup.Add(camera.StreamBinding!, SupportedProtocol.Rtsp, "/stream2", StreamRole.None);
        StreamLineup.SetEnabled(sub, enabled: false);

        // Act
        var change = StreamLineup.SetRole(camera.StreamBinding!, sub, StreamRole.Detect);

        // Assert
        Assert.Equal(StreamChange.StreamDisabled, change);
    }

    [Fact]
    public void SetEnabled_ShouldRefuse_WhenTheStreamRecords()
    {
        // Arrange
        var camera = MakeCamera();

        // Act
        var change = StreamLineup.SetEnabled(camera.MainStream!, enabled: false);

        // Assert
        Assert.Equal(StreamChange.StreamRecords, change);
        Assert.True(camera.MainStream!.Enabled);
    }

    [Fact]
    public void SetEnabled_ShouldLeaveDetectionOnTheRecordingStream_WhenTheDetectStreamIsDisabled()
    {
        // Arrange
        var camera = MakeCamera();
        var sub = StreamLineup.Add(camera.StreamBinding!, SupportedProtocol.Rtsp, "/stream2", StreamRole.Detect);

        // Act
        StreamLineup.SetEnabled(sub, enabled: false);

        // Assert
        Assert.Equal(StreamRole.None, sub.Role);
        Assert.True(camera.DetectsOnRecordingStream);
        Assert.Same(camera.MainStream, camera.DetectStream);
    }

    [Fact]
    public void Remove_ShouldRefuse_WhenTheStreamRecords()
    {
        // Arrange
        var camera = MakeCamera();

        // Act
        var change = StreamLineup.Remove(camera.StreamBinding!, camera.MainStream!);

        // Assert
        Assert.Equal(StreamChange.StreamRecords, change);
        Assert.Single(camera.Streams);
    }

    [Fact]
    public void Add_ShouldTakeDetectionFromTheMainStream_WhenTheNewStreamIsGivenIt()
    {
        // Arrange
        var camera = MakeCamera();

        // Act
        var sub = StreamLineup.Add(camera.StreamBinding!, SupportedProtocol.Rtsp, "/stream2", StreamRole.Detect);

        // Assert
        Assert.Equal(StreamRole.Record, camera.MainStream!.Role);
        Assert.Equal(1, sub.Ordinal);
        Assert.Same(sub, camera.DetectStream);
    }

    [Fact]
    public void ResetTo_ShouldLeaveOneMainStreamRecordingAndDetecting_WhenTheProtocolChanges()
    {
        // Arrange
        var camera = MakeCamera();
        var binding = camera.StreamBinding!;
        StreamLineup.Add(binding, SupportedProtocol.Rtsp, "/stream2", StreamRole.Detect);
        binding.StreamsFoundAt = DateTimeOffset.UnixEpoch;

        // Act
        StreamLineup.ResetTo(binding, SupportedProtocol.Dvrip, mainPath: null);

        // Assert
        var main = Assert.Single(camera.Streams);
        Assert.Equal(SupportedProtocol.Dvrip, main.Protocol);
        Assert.Equal(StreamRole.RecordAndDetect, main.Role);
        Assert.Null(binding.StreamsFoundAt);
    }

    [Fact]
    public void ApplyFound_ShouldKeepTheUsersRoles_WhenTheStreamsAreFoundAfterAChange()
    {
        // Arrange
        var camera = MakeCamera();
        var binding = camera.StreamBinding!;
        var hand = StreamLineup.Add(binding, SupportedProtocol.Rtsp, "/custom", StreamRole.Detect);

        // Act
        StreamLineup.ApplyFound(binding, [new EnumeratedStream("/stream1", 1920, 1080, 25), new EnumeratedStream("/stream2", 640, 360, 25)], DateTimeOffset.UnixEpoch);

        // Assert
        Assert.Same(hand, camera.DetectStream);
        Assert.Equal(StreamRole.None, camera.Streams.Single(stream => stream.Path == "/stream2").Role);
        Assert.Equal(DateTimeOffset.UnixEpoch, binding.StreamsFoundAt);
    }
}
