using System.Net;
using System.Net.Http.Json;

namespace Vyzio.Tests.Integration;

public class CameraStreamsEndpointsTests : IClassFixture<CamerasApiFactory>
{
    private readonly CamerasApiFactory _factory;

    public CameraStreamsEndpointsTests(CamerasApiFactory factory)
    {
        _factory = factory;
        _factory.ResetState();
    }

    private sealed record StreamLine(string Id, string Protocol, string? Path, string Role, bool Verified);

    private sealed record AvailableStream(int Rank, string? Path, string? StreamId);

    private sealed record LineupResponse(StreamLine[] Streams, string? RecordStreamId, string? DetectStreamId, bool DetectsOnRecordingStream);

    [Fact]
    public async Task GetStreams_ShouldListTheMainStreamRecordingAndDetecting_WhenTheCameraHasOnlyIt()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var lineup = await client.GetFromJsonAsync<LineupResponse>("/api/cameras/camera-1/streams");

        // Assert
        var main = Assert.Single(lineup!.Streams);
        Assert.Equal("record_and_detect", main.Role);
        Assert.Equal("rtsp", main.Protocol);
        Assert.False(lineup.DetectsOnRecordingStream);
    }

    [Fact]
    public async Task RemoveStream_ShouldRefuseWithItsCode_WhenTheStreamRecords()
    {
        // Arrange
        using var client = _factory.CreateClient();
        var lineup = await client.GetFromJsonAsync<LineupResponse>("/api/cameras/camera-1/streams");

        // Act
        var response = await client.DeleteAsync($"/api/cameras/camera-1/streams/{lineup!.RecordStreamId}");

        // Assert
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("stream_records", await response.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task AddStream_ShouldCheckItAndGiveItDetection_WhenItIsAddedWithTheDetectRole()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.PostAsJsonAsync("/api/cameras/camera-1/streams",
            new { protocol = "rtsp", path = "stream2", role = "detect" });

        // Assert
        response.EnsureSuccessStatusCode();
        var lineup = await response.Content.ReadFromJsonAsync<LineupResponse>();
        var added = Assert.Single(lineup!.Streams, stream => stream.Path == "/stream2");
        Assert.True(added.Verified);
        Assert.Equal(added.Id, lineup.DetectStreamId);
        Assert.Contains(lineup.Streams, stream => stream.Role == "record");
    }

    [Fact]
    public async Task AddStream_ShouldRefuseWithItsCode_WhenAnRtspPathIsEmpty()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.PostAsJsonAsync("/api/cameras/camera-1/streams",
            new { protocol = "rtsp", path = " ", role = "none" });

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("stream_path_required", await response.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task GetAvailableStreams_ShouldAnswerAnEmptyList_WhenTheCameraListsNothingOverRtsp()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var available = await client.GetFromJsonAsync<AvailableStream[]>("/api/cameras/camera-1/streams/available?protocol=rtsp");

        // Assert
        Assert.Empty(available!);
    }

    [Fact]
    public async Task GetAvailableStreams_ShouldRefuseWithItsCode_WhenNoStreamProviderSpeaksTheProtocol()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/cameras/camera-1/streams/available?protocol=onvif");

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("unknown_protocol", await response.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task RemoveStream_ShouldFallBackToTheRecordingStream_WhenTheDetectStreamIsRemoved()
    {
        // Arrange
        using var client = _factory.CreateClient();
        var added = await (await client.PostAsJsonAsync("/api/cameras/camera-1/streams",
            new { protocol = "rtsp", path = "stream2", role = "detect" })).Content.ReadFromJsonAsync<LineupResponse>();

        // Act
        var response = await client.DeleteAsync($"/api/cameras/camera-1/streams/{added!.DetectStreamId}");

        // Assert
        response.EnsureSuccessStatusCode();
        var lineup = await response.Content.ReadFromJsonAsync<LineupResponse>();
        Assert.True(lineup!.DetectsOnRecordingStream);
        Assert.Equal(lineup.RecordStreamId, lineup.DetectStreamId);
    }
}
