using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Vyzio.Api.Integration.Frigate;
using Vyzio.Application.UseCases.Frigate;
using Vyzio.Application.UseCases.Notifications;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Persistence;
using Vyzio.Infrastructure.Persistence.Repositories;

namespace Vyzio.Tests.Integration;

public sealed class FrigateNotificationFlowIntegrationTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly VyzioDbContext _db;
    private readonly DetectionEventRepository _detectionEvents;
    private readonly NotificationRepository _notifications;
    private readonly RecordingTelegramSender _telegramSender;
    private readonly StubFrigateRestClient _restClient;
    private readonly FrigateAdapter _sut;

    public FrigateNotificationFlowIntegrationTests()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<VyzioDbContext>()
            .UseSqlite(_connection)
            .UseSnakeCaseNamingConvention()
            .Options;

        _db = new VyzioDbContext(options);
        _db.Database.EnsureCreated();

        _detectionEvents = new DetectionEventRepository(_db);
        _notifications = new NotificationRepository(_db);
        _telegramSender = new RecordingTelegramSender();
        _restClient = new StubFrigateRestClient();

        var dispatcher = new SendTelegramDetectionNotificationUseCase(
            _notifications,
            _telegramSender,
            new TelegramDetectionNotificationPolicy(telegramEnabled: true, minimumConfidence: 0.75f),
            new DetectionTelegramMessageFormatter());

        _sut = new FrigateAdapter(
            new FrigateEventContractAdapter(new FrigateLabelFilter(["person"])),
            _detectionEvents,
            dispatcher,
            _restClient,
            NullLogger<FrigateAdapter>.Instance);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task ProcessMessageAsync_persists_detection_and_sent_notification_for_a_relevant_new_event()
    {
        _restClient.Identity = "Alice";

        var processed = await _sut.ProcessMessageAsync("frigate/events", RelevantPayload("frigate-ti-001", lifecycle: "new", topScore: 0.97f));

        Assert.True(processed);

        var detection = await _db.DetectionEvents.SingleAsync();
        Assert.Equal("frigate-ti-001", detection.FrigateEventId);
        Assert.Equal("Alice", detection.Identity);
        Assert.Equal("new", detection.Lifecycle);

        var notification = await _db.Notifications.SingleAsync();
        Assert.Equal(detection.Id, notification.EventId);
        Assert.Equal("telegram", notification.Channel);
        Assert.Equal("sent", notification.Status);

        Assert.Equal(["Alice detectee - front door - 10:20"], _telegramSender.Messages);
    }

    [Fact]
    public async Task ProcessMessageAsync_does_not_create_duplicate_notification_when_the_same_event_is_updated()
    {
        _restClient.Identity = "Alice";

        await _sut.ProcessMessageAsync("frigate/events", RelevantPayload("frigate-ti-002", lifecycle: "new", topScore: 0.96f));
        await _sut.ProcessMessageAsync("frigate/events", RelevantPayload("frigate-ti-002", lifecycle: "update", topScore: 0.98f, hasClip: false));

        Assert.Equal(1, await _db.DetectionEvents.CountAsync());
        Assert.Equal(1, await _db.Notifications.CountAsync());

        var detection = await _db.DetectionEvents.SingleAsync();
        Assert.Equal("update", detection.Lifecycle);
        Assert.False(detection.HasClip);

        Assert.Single(_telegramSender.Messages);
    }

    [Fact]
    public async Task ProcessMessageAsync_ignores_filtered_labels_without_persisting_or_notifying()
    {
        var processed = await _sut.ProcessMessageAsync("frigate/events", RelevantPayload("frigate-ti-003", label: "cat", lifecycle: "new", topScore: 0.91f));

        Assert.False(processed);
        Assert.Equal(0, await _db.DetectionEvents.CountAsync());
        Assert.Equal(0, await _db.Notifications.CountAsync());
        Assert.Empty(_telegramSender.Messages);
    }

    private static string RelevantPayload(
        string eventId,
        string label = "person",
        string lifecycle = "new",
        float topScore = 0.97f,
        bool hasClip = true,
        bool hasSnapshot = true)
        => $$"""
        {
          "type": "{{lifecycle}}",
          "after": {
            "id": "{{eventId}}",
            "camera": "front_door",
            "label": "{{label}}",
            "top_score": {{topScore.ToString(System.Globalization.CultureInfo.InvariantCulture)}},
            "start_time": 1778408400,
            "has_clip": {{hasClip.ToString().ToLowerInvariant()}},
            "has_snapshot": {{hasSnapshot.ToString().ToLowerInvariant()}},
            "entered_zones": ["porch"]
          }
        }
        """;

    private sealed class RecordingTelegramSender : ITelegramNotificationSender
    {
        public List<string> Messages { get; } = [];

        public Task SendAsync(string message, CancellationToken ct = default)
        {
            Messages.Add(message);
            return Task.CompletedTask;
        }
    }

    private sealed class StubFrigateRestClient : IFrigateRestClient
    {
        public string? Identity { get; set; }

        public Task<string?> TryGetIdentityAsync(string frigateEventId, CancellationToken ct = default)
            => Task.FromResult(Identity);
    }
}