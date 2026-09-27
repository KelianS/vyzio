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

    private sealed record StreamLine(string Id, string Protocol, string? Path, string Role, bool Enabled, bool Verified);

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
    public async Task AddStream_ShouldCheckItAndGiveItDetection_WhenItIsDeclaredWithTheDetectRole()
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
    public async Task DisableStream_ShouldFallBackToTheRecordingStream_WhenTheDetectStreamIsDisabled()
    {
        // Arrange
        using var client = _factory.CreateClient();
        var added = await (await client.PostAsJsonAsync("/api/cameras/camera-1/streams",
            new { protocol = "rtsp", path = "stream2", role = "detect" })).Content.ReadFromJsonAsync<LineupResponse>();

        // Act
        var response = await client.PutAsJsonAsync($"/api/cameras/camera-1/streams/{added!.DetectStreamId}/enabled", new { enabled = false });

        // Assert
        response.EnsureSuccessStatusCode();
        var lineup = await response.Content.ReadFromJsonAsync<LineupResponse>();
        Assert.True(lineup!.DetectsOnRecordingStream);
        Assert.Equal(lineup.RecordStreamId, lineup.DetectStreamId);
    }
}
