using System.Net;
using System.Net.Http.Json;
using Vyzio.Application.DTOs.Cameras;

namespace Vyzio.Tests.Integration;

public class CamerasCutEndpointsTests : IClassFixture<CamerasApiFactory>
{
    private readonly CamerasApiFactory _factory;

    public CamerasCutEndpointsTests(CamerasApiFactory factory)
    {
        _factory = factory;
        _factory.ResetState();
    }

    [Fact]
    public async Task CutCameras_ShouldCutEveryCameraUntilAWholeMinute_WhenADurationIsChosen()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.PutAsJsonAsync("/api/cameras/privacy/cut", new { minutes = 60 });

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var camera = Assert.Single((await client.GetFromJsonAsync<List<CameraDto>>("/api/cameras"))!);
        Assert.True(camera.PrivacyModeActive);
        Assert.InRange(camera.PrivacyCutUntil!.At, DateTimeOffset.UtcNow.AddMinutes(59), DateTimeOffset.UtcNow.AddMinutes(62));
        Assert.Equal(0, camera.PrivacyCutUntil.At.Second);
    }

    [Fact]
    public async Task CutCameras_ShouldHoldUntilResumed_WhenNoEndIsGiven()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.PutAsJsonAsync("/api/cameras/privacy/cut", new { });

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var camera = Assert.Single((await client.GetFromJsonAsync<List<CameraDto>>("/api/cameras"))!);
        Assert.Equal((true, "manual"), (camera.PrivacyModeActive, camera.PrivacyModeSource));
        Assert.Null(camera.PrivacyCutUntil);
    }

    [Fact]
    public async Task CutCameras_ShouldAnswerARefusalAndCutNothing_WhenTheEndIsAlreadyPast()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.PutAsJsonAsync("/api/cameras/privacy/cut", new { until = DateTimeOffset.UtcNow.AddHours(-1) });

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("cut_end_not_ahead", await response.Content.ReadAsStringAsync());
        var camera = Assert.Single((await client.GetFromJsonAsync<List<CameraDto>>("/api/cameras"))!);
        Assert.False(camera.PrivacyModeActive);
    }

    [Fact]
    public async Task GetCamerasCut_ShouldAnswer_WhenTheHomeOpensTheCutSheet()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/cameras/privacy/cut");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(await response.Content.ReadFromJsonAsync<CamerasCutDto>());
    }
}
