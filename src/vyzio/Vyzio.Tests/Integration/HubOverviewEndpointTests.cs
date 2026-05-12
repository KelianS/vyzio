using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Vyzio.Core.Entities;
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

    public sealed record DetectionEventResponse(string EventId, string FrigateEventId, string Lifecycle, string Camera, string Label, string? Identity, string? ProfileId, float? Confidence, DateTimeOffset OccurredAt, bool HasClip, bool HasSnapshot);

    public sealed record ProfileResponse(string Id, string Name, string Category, string AlertMode, DateTimeOffset? LastSeenAt, DateTimeOffset CreatedAt);

    public sealed record HubOverviewResponse(bool SystemHealthy, DetectionEventResponse[] RecentEvents, ProfileResponse[] Profiles, NotificationSummaryResponse Notifications, string[] Warnings);
}

public sealed class HubOverviewApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("VYZIO_CONFIG_PATH", FindRepoFile("config", "vyzio.yml"));

        builder.ConfigureServices(services =>
        {
            _connection.Open();

            services.RemoveAll<IHostedService>();
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

            db.DetectionEvents.Add(new DetectionEvent
            {
                FrigateEventId = "frigate-hub-001",
                Lifecycle = "new",
                Camera = "front_door",
                Label = "person",
                Identity = "Alice",
                OccurredAt = DateTimeOffset.Parse("2026-05-12T09:00:00+00:00"),
                ProfileId = profile.Id,
                HasSnapshot = true,
                HasClip = true
            });

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

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            _connection.Dispose();
        }
    }

    private static string FindRepoFile(params string[] segments)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);

        while (directory is not null)
        {
            var candidate = Path.Combine(directory.FullName, segments[0], segments.Length > 1 ? Path.Combine(segments[1..]) : string.Empty);
            if (File.Exists(candidate))
            {
                return candidate;
            }

            directory = directory.Parent;
        }

        throw new FileNotFoundException($"Unable to locate {Path.Combine(segments)} from test output directory.");
    }
}