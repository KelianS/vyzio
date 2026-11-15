using System.Net;
using System.Net.Http.Json;
using Vyzio.Application.DTOs.Notifications;

namespace Vyzio.Tests.Integration;

public class SilenceEndpointsTests : IClassFixture<CamerasApiFactory>
{
    private readonly CamerasApiFactory _factory;

    public SilenceEndpointsTests(CamerasApiFactory factory)
    {
        _factory = factory;
        _factory.ResetState();
    }

    [Fact]
    public async Task StartSilence_ShouldKeepTheSilenceActiveUntilItsEnd_WhenADurationIsChosen()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.PutAsJsonAsync("/api/notifications/silence", new { minutes = 60 });

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var read = await client.GetFromJsonAsync<SilenceDto>("/api/notifications/silence");
        Assert.True(read!.Active);
        Assert.InRange(read.Until!.At, DateTimeOffset.UtcNow.AddMinutes(55), DateTimeOffset.UtcNow.AddMinutes(61));
    }

    [Fact]
    public async Task StopSilence_ShouldLeaveNotificationsFlowing_WhenTheUserEndsTheSilence()
    {
        // Arrange
        using var client = _factory.CreateClient();
        await client.PutAsJsonAsync("/api/notifications/silence", new { minutes = 30 });

        // Act
        var response = await client.DeleteAsync("/api/notifications/silence");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var read = await client.GetFromJsonAsync<SilenceDto>("/api/notifications/silence");
        Assert.Equal((false, (HouseMomentDto?)null), (read!.Active, read.Until));
    }

    [Fact]
    public async Task StartSilence_ShouldAnswerARefusalWithItsCode_WhenNoEndIsGiven()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.PutAsJsonAsync("/api/notifications/silence", new { });

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("silence_no_single_end", await response.Content.ReadAsStringAsync());
    }
}
