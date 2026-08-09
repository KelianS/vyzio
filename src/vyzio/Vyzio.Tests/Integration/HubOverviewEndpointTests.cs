using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Persistence;

namespace Vyzio.Tests.Integration;

public class HubOverviewEndpointTests : IClassFixture<HubOverviewApiFactory>
{
    private readonly HubOverviewApiFactory _factory;

    public HubOverviewEndpointTests(HubOverviewApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetOverview_returns_aggregated_hub_payload()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/hub/overview");

        response.EnsureSuccessStatusCode();
        var payload = await response.Content.ReadFromJsonAsync<HubOverviewResponse>();

        Assert.NotNull(payload);
        Assert.True(payload!.SystemHealthy);
        Assert.Single(payload.RecentEvents);
        Assert.Single(payload.Profiles);
        Assert.Equal(1, payload.Notifications.SentCount);
    }

    public sealed record NotificationSummaryResponse(bool TelegramConfigured, int SentCount, DateTimeOffset? LastSentAt);

    public sealed record DetectionEventResponse(string EventId, string Camera, string CameraName, string Label, string? Identity, string? ProfileId, float? Confidence, DateTimeOffset OccurredAt, bool HasClip, bool HasSnapshot);

    public sealed record ProfileResponse(string Id, string Name, string Category, string AlertMode, DateTimeOffset? LastSeenAt, DateTimeOffset CreatedAt);

    public sealed record HubOverviewResponse(bool SystemHealthy, DetectionEventResponse[] RecentEvents, ProfileResponse[] Profiles, NotificationSummaryResponse Notifications, string[] Warnings);
}

public sealed class HubOverviewApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        builder.ConfigureServices(services =>
        {
            _connection.Open();

            services.RemoveAll<IHostedService>();
            services.RemoveAll<IFrigateEventReader>();
            services.AddSingleton<IFrigateEventReader, StubFrigateEventReader>();
            services.RemoveAll<DbContextOptions<VyzioDbContext>>();
            services.RemoveAll<VyzioDbContext>();

            services.AddDbContext<VyzioDbContext>(options =>
                options.UseSqlite(_connection)
                       .UseSnakeCaseNamingConvention());

            using var scope = services.BuildServiceProvider().CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<VyzioDbContext>();
            db.Database.Migrate();

            var profile = new Profile { Name = "Alice", Category = "household", AlertMode = "notify" };
            db.Profiles.Add(profile);
            db.SaveChanges();

            db.Notifications.Add(new Notification
            {
                EventId = "event-1",
                Channel = "telegram",
                Status = "sent",
                SentAt = DateTimeOffset.Parse("2026-05-12T09:05:00+00:00")
            });

            db.SaveChanges();
        });
    }

    // L'accueil lit desormais Frigate : rien a semer en base pour une detection (ADR-49).
    private sealed class StubFrigateEventReader : IFrigateEventReader
    {
        public Task<string?> TryGetIdentityAsync(string frigateEventId, CancellationToken ct = default)
            => Task.FromResult<string?>(null);

        public Task<IReadOnlyList<FrigateDetection>> QueryAsync(FrigateDetectionQuery query, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<FrigateDetection>>(
            [
                new FrigateDetection("frigate-hub-001", "front_door", "person", "Alice", 0.92f,
                    DateTimeOffset.Parse("2026-05-12T09:00:00+00:00"), HasClip: true, HasSnapshot: true)
            ]);
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