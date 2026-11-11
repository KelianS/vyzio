using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Persistence;

namespace Vyzio.Tests.Integration;

public class DeleteDetectionEndpointTests(DeleteDetectionApiFactory factory) : IClassFixture<DeleteDetectionApiFactory>
{
    private async Task<(HttpStatusCode Status, string Body)> DeleteAsync(string eventId)
    {
        using var client = factory.CreateClient();
        var response = await client.DeleteAsync($"/api/detection-events/{eventId}");
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Delete_ShouldAnswerNoContentAndDropTheNotificationRows_WhenTheDetectionIsErased()
    {
        // Arrange
        factory.Eraser.EraseAsync("evt-erased", Arg.Any<CancellationToken>()).Returns(DetectionErasure.Erased);
        factory.SeedNotification("evt-erased");

        // Act
        var (status, _) = await DeleteAsync("evt-erased");

        // Assert
        Assert.Equal(HttpStatusCode.NoContent, status);
        Assert.Equal(0, factory.CountNotifications("evt-erased"));
    }

    [Theory]
    [InlineData(DetectionErasure.NotFound, HttpStatusCode.NotFound, "detection_not_found")]
    [InlineData(DetectionErasure.InProgress, HttpStatusCode.Conflict, "detection_in_progress")]
    public async Task Delete_ShouldNameWhyNothingWasErased_WhenTheDetectionIsUnknownOrStillFilmed(
        DetectionErasure erasure, HttpStatusCode expectedStatus, string expectedError)
    {
        // Arrange
        factory.Eraser.EraseAsync("evt-refused", Arg.Any<CancellationToken>()).Returns(erasure);

        // Act
        var (status, body) = await DeleteAsync("evt-refused");

        // Assert
        Assert.Equal(expectedStatus, status);
        Assert.Equal(expectedError, JsonDocument.Parse(body).RootElement.GetProperty("error").GetString());
    }

    [Theory]
    [InlineData(false, "erasure_failed")]
    [InlineData(true, "erasure_incomplete")]
    public async Task Delete_ShouldAnswerHowFarItGotAndKeepTheNotificationRows_WhenFrigateFails(
        bool partlyErased, string expectedError)
    {
        // Arrange
        var eventId = $"evt-failed-{expectedError}";
        factory.Eraser.EraseAsync(eventId, Arg.Any<CancellationToken>())
            .ThrowsAsync(new DetectionErasureFailedException("DELETE /api/events/x answered 500", partlyErased));
        factory.SeedNotification(eventId);

        // Act
        var (status, body) = await DeleteAsync(eventId);

        // Assert
        var root = JsonDocument.Parse(body).RootElement;
        Assert.Equal(HttpStatusCode.BadGateway, status);
        Assert.Equal(expectedError, root.GetProperty("error").GetString());
        Assert.Equal("DELETE /api/events/x answered 500", root.GetProperty("message").GetString());
        Assert.Equal(1, factory.CountNotifications(eventId));
    }
}

public class DetectionClipEndpointTests(DeleteDetectionApiFactory factory) : IClassFixture<DeleteDetectionApiFactory>
{
    [Fact]
    public async Task GetClip_ShouldAnswerNotFound_WhenFrigateSaysTheClipNoLongerExists()
    {
        // Arrange
        factory.Clips.ReadClipAsync("evt-gone", Arg.Any<CancellationToken>()).Returns((Stream?)null);
        using var client = factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/detection-events/evt-gone/clip");

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetClip_ShouldAnswerBadGatewayWithTheDetail_WhenFrigateFailsToServeIt()
    {
        // Arrange
        factory.Clips.ReadClipAsync("evt-down", Arg.Any<CancellationToken>())
            .ThrowsAsync(new FrigateClipUnreadableException("GET api/events/evt-down/clip.mp4 got no answer"));
        using var client = factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/detection-events/evt-down/clip");

        // Assert
        var root = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        Assert.Equal("clip_unreadable", root.GetProperty("error").GetString());
        Assert.Equal("GET api/events/evt-down/clip.mp4 got no answer", root.GetProperty("message").GetString());
    }
}

public sealed class DeleteDetectionApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");

    public IFrigateDetectionEraser Eraser { get; } = Substitute.For<IFrigateDetectionEraser>();
    public IFrigateClipProvider Clips { get; } = Substitute.For<IFrigateClipProvider>();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        builder.ConfigureServices(services =>
        {
            _connection.Open();

            services.RemoveAll<IHostedService>();
            services.RemoveAll<IFrigateDetectionEraser>();
            services.AddSingleton(Eraser);
            services.RemoveAll<IFrigateClipProvider>();
            services.AddSingleton(Clips);
            services.RemoveAll<DbContextOptions<VyzioDbContext>>();
            services.RemoveAll<VyzioDbContext>();
            services.AddDbContext<VyzioDbContext>(options =>
                options.UseSqlite(_connection).UseSnakeCaseNamingConvention());

            using var scope = services.BuildServiceProvider().CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<VyzioDbContext>();
            db.Database.Migrate();
            SignedInTestClient.SeedOwnerSession(db);
        });
    }

    public void SeedNotification(string eventId)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VyzioDbContext>();
        db.Notifications.Add(new Notification
        {
            FrigateEventId = eventId,
            Channel = NotificationChannel.Telegram,
            Camera = "front_door",
            Label = "person",
            Status = NotificationStatus.Sent,
        });
        db.SaveChanges();
    }

    public int CountNotifications(string eventId)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VyzioDbContext>();
        return db.Notifications.Count(n => n.FrigateEventId == eventId);
    }

    protected override void ConfigureClient(HttpClient client)
    {
        base.ConfigureClient(client);
        client.DefaultRequestHeaders.Add("Cookie", SignedInTestClient.Cookie);
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            _connection.Dispose();
        }
    }
}
