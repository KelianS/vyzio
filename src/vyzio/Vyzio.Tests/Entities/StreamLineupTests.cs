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
        Assert.Equal(StreamRole.Detect, camera.Streams.First().Role);
        Assert.Same(sub, camera.RecordStream);
    }

    [Fact]
    public void SetRole_ShouldRefuse_WhenTheRecordingStreamWouldStopRecording()
    {
        // Arrange
        var camera = MakeCamera();

        // Act
        var change = StreamLineup.SetRole(camera.StreamBinding!, camera.Streams.First(), StreamRole.Detect);

        // Assert
        Assert.Equal(StreamChange.StreamRecords, change);
        Assert.Equal(StreamRole.RecordAndDetect, camera.Streams.First().Role);
    }

    [Fact]
    public void Remove_ShouldLeaveDetectionOnTheRecordingStream_WhenTheDetectStreamIsRemoved()
    {
        // Arrange
        var camera = MakeCamera();
        var sub = StreamLineup.Add(camera.StreamBinding!, SupportedProtocol.Rtsp, "/stream2", StreamRole.Detect);

        // Act
        StreamLineup.Remove(camera.StreamBinding!, sub);

        // Assert
        Assert.True(camera.DetectsOnRecordingStream);
        Assert.Same(camera.Streams.First(), camera.DetectStream);
    }

    [Fact]
    public void Offer_ShouldNameTheLineAStreamAlreadyIs_WhenItsPathIsListed()
    {
        // Arrange
        var camera = MakeCamera();
        EnumeratedStream[] found = [new("/stream1", 1920, 1080, 15), new("/stream2", 640, 360, 15)];

        // Act
        var offers = StreamLineup.Offer(camera.StreamBinding!, SupportedProtocol.Rtsp, found);

        // Assert
        Assert.Equal(camera.Streams.First().Id, offers[0].StreamId);
        Assert.Null(offers[1].StreamId);
        Assert.Equal(1, offers[1].Rank);
    }

    [Fact]
    public void Offer_ShouldNotMatchALine_WhenTheLineGoesThroughAnotherProtocol()
    {
        // Arrange
        var camera = MakeCamera();
        EnumeratedStream[] found = [new("/stream1", null, null, null)];

        // Act
        var offers = StreamLineup.Offer(camera.StreamBinding!, SupportedProtocol.Dvrip, found);

        // Assert
        Assert.Null(offers[0].StreamId);
    }

    [Fact]
    public void Remove_ShouldRefuse_WhenTheStreamRecords()
    {
        // Arrange
        var camera = MakeCamera();

        // Act
        var change = StreamLineup.Remove(camera.StreamBinding!, camera.Streams.First());

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
        Assert.Equal(StreamRole.Record, camera.Streams.First().Role);
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
        StreamLineup.ResetTo(binding, SupportedProtocol.Dvrip, path: null);

        // Assert
        var main = Assert.Single(camera.Streams);
        Assert.Equal(SupportedProtocol.Dvrip, main.Protocol);
        Assert.Equal(StreamRole.RecordAndDetect, main.Role);
        Assert.Null(binding.StreamsFoundAt);
    }

    [Fact]
    public void ResetToFound_ShouldReplaceEveryStreamByTheFoundOnesWithTheDefaults_WhenTheCameraListsThem()
    {
        // Arrange
        var camera = MakeCamera();
        var binding = camera.StreamBinding!;
        StreamLineup.Add(binding, SupportedProtocol.Rtsp, "/custom", StreamRole.Detect);

        // Act
        StreamLineup.ResetToFound(binding, SupportedProtocol.Rtsp, [new EnumeratedStream("/main", 1920, 1080, 25), new EnumeratedStream("/sub", 640, 360, 25)], DateTimeOffset.UnixEpoch);

        // Assert
        Assert.Equal(["/main", "/sub"], camera.Streams.Select(stream => stream.Path));
        Assert.Equal("/main", camera.RecordStream!.Path);
        Assert.Equal("/sub", camera.DetectStream!.Path);
        Assert.Equal(DateTimeOffset.UnixEpoch, binding.StreamsFoundAt);
    }

    [Fact]
    public void ApplyFound_ShouldAddTheFirstReportedStream_WhenItIsNotListedYet()
    {
        // Arrange
        var camera = MakeCamera();
        var binding = camera.StreamBinding!;

        // Act
        StreamLineup.ApplyFound(binding, [new EnumeratedStream("/main", 1920, 1080, 25), new EnumeratedStream("/stream1", 640, 360, 25)], DateTimeOffset.UnixEpoch);

        // Assert
        Assert.Equal(["/stream1", "/main"], camera.Streams.Select(stream => stream.Path));
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
