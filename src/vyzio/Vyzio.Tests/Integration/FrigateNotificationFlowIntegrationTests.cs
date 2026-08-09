using NSubstitute;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Vyzio.Application.UseCases.Frigate;
using Vyzio.Application.UseCases.Notifications;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Persistence;
using Vyzio.Infrastructure.Persistence.Repositories;

namespace Vyzio.Tests.Integration;

public sealed class FrigateNotificationFlowIntegrationTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly VyzioDbContext _db;
    private readonly NotificationRepository _notifications;
    private readonly RecordingTelegramSender _telegramSender;
    private readonly StubFrigateEventReader _eventReader;
    private readonly StubClipProvider _clipProvider;
    private readonly TestDetectionQueue _queue;
    private readonly NotifyDetectionUseCase _notify;
    private readonly IngestFrigateEventUseCase _sut;

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

        _notifications = new NotificationRepository(_db);
        _telegramSender = new RecordingTelegramSender();
        _eventReader = new StubFrigateEventReader();
        _clipProvider = new StubClipProvider();

        var channelConfigs = new NotificationChannelConfigRepository(_db);
        channelConfigs.UpsertAsync(new NotificationChannelConfig
        {
            Channel = "telegram",
            IsEnabled = true,
            BotToken = "test-bot-token",
            ChatId = "test-chat-id",
            MinimumConfidence = 0.75f
        }).GetAwaiter().GetResult();

        var dispatcher = new SendTelegramDetectionNotificationUseCase(
            _notifications,
            _telegramSender,
            channelConfigs,
            Substitute.For<IFrigateSnapshotProvider>(),
            _clipProvider,
            new DetectionTelegramMessageFormatter(),
            TimeZoneInfo.Local,
            NullLogger<SendTelegramDetectionNotificationUseCase>.Instance,
            mediaFinalizationWindow: TimeSpan.Zero);

        _queue = new TestDetectionQueue();
        _notify = new NotifyDetectionUseCase(
            _eventReader, dispatcher, NullLogger<NotifyDetectionUseCase>.Instance);

        _sut = new IngestFrigateEventUseCase(
            new FrigateEventContractAdapter(new FrigateLabelFilter(["person"])),
            _queue,
            NullLogger<IngestFrigateEventUseCase>.Instance);
    }

    // The handler only enqueues (ADR-49): the flow is complete once the queue is drained.
    private async Task<bool> IngestAndNotifyAsync(string payload)
    {
        var ingested = await _sut.ExecuteAsync("frigate/events", payload);

        while (_queue.TryDequeue(out var detection))
        {
            await _notify.ExecuteAsync(detection);
        }

        return ingested;
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task ExecuteAsync_ignores_an_event_still_in_progress()
    {
        _eventReader.Identity = "Alice";

        var processed = await IngestAndNotifyAsync(Payload("frigate-ti-001", lifecycle: "new", topScore: 0.97f));

        // Nothing to keep, nothing to send: only the end of an event matters (ADR-49).
        Assert.False(processed);
        Assert.Equal(0, await _db.Notifications.CountAsync());
        Assert.Empty(_telegramSender.Messages);
    }

    [Fact]
    public async Task ExecuteAsync_sends_notification_with_clip_on_end()
    {
        _eventReader.Identity = "Alice";
        _clipProvider.Clip = new MemoryStream(new byte[] { 1, 2, 3 });

        await IngestAndNotifyAsync(Payload("frigate-ti-002", lifecycle: "end", topScore: 0.97f, hasClip: true));

        Assert.Equal(1, await _db.Notifications.CountAsync());
        // Snapshot provider returns null → media group not possible → video-only fallback
        Assert.Single(_telegramSender.Videos);
        Assert.Empty(_telegramSender.MediaGroups);
        Assert.Empty(_telegramSender.Messages);

        var notification = await _db.Notifications.SingleAsync();
        Assert.Equal("sent", notification.Status);
        Assert.Equal("frigate-ti-002", notification.FrigateEventId);
        Assert.Equal("front_door", notification.Camera);
        Assert.Equal("person", notification.Label);
    }

    [Fact]
    public async Task ExecuteAsync_does_not_create_duplicate_notification_on_multiple_end_events()
    {
        _eventReader.Identity = "Alice";

        await IngestAndNotifyAsync(Payload("frigate-ti-003", lifecycle: "end", hasClip: false));
        await IngestAndNotifyAsync(Payload("frigate-ti-003", lifecycle: "end", hasClip: false));

        Assert.Equal(1, await _db.Notifications.CountAsync());
        Assert.Single(_telegramSender.Messages);
    }

    [Fact]
    public async Task ExecuteAsync_ignores_filtered_labels_without_notifying()
    {
        var processed = await IngestAndNotifyAsync(Payload("frigate-ti-004", label: "cat", lifecycle: "end", topScore: 0.91f));

        Assert.False(processed);
        Assert.Equal(0, await _db.Notifications.CountAsync());
        Assert.Empty(_telegramSender.Messages);
    }

    private static string Payload(
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
        public List<string> Videos { get; } = [];
        public List<string> MediaGroups { get; } = [];

        public Task SendAsync(string message, string botToken, string chatId, CancellationToken ct = default)
        {
            Messages.Add(message);
            return Task.CompletedTask;
        }

        public Task SendPhotoAsync(Stream photo, string caption, string botToken, string chatId, CancellationToken ct = default)
        {
            Messages.Add(caption);
            return Task.CompletedTask;
        }

        public Task SendVideoAsync(Stream video, Stream? thumbnail, string caption, string botToken, string chatId, CancellationToken ct = default)
        {
            Videos.Add(caption);
            return Task.CompletedTask;
        }

        public Task SendMediaGroupAsync(Stream photo, Stream video, string caption, string botToken, string chatId, CancellationToken ct = default)
        {
            MediaGroups.Add(caption);
            return Task.CompletedTask;
        }
    }

    private sealed class TestDetectionQueue : IDetectionNotificationQueue
    {
        private readonly Queue<FrigateDetection> _pending = new();

        public bool TryEnqueue(FrigateDetection detection)
        {
            _pending.Enqueue(detection);
            return true;
        }

        public bool TryDequeue(out FrigateDetection detection) => _pending.TryDequeue(out detection!);

        // The worker is not what this test exercises: the flow is drained synchronously.
        public IAsyncEnumerable<FrigateDetection> ReadAllAsync(CancellationToken ct = default)
            => throw new NotSupportedException();
    }

    private sealed class StubFrigateEventReader : IFrigateEventReader
    {
        public string? Identity { get; set; }

        public Task<string?> TryGetIdentityAsync(string frigateEventId, CancellationToken ct = default)
            => Task.FromResult(Identity);

        public Task<IReadOnlyList<FrigateDetection>> QueryAsync(FrigateDetectionQuery query, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<FrigateDetection>>([]);
    }

    private sealed class StubClipProvider : IFrigateClipProvider
    {
        public Stream? Clip { get; set; }

        public Task<Stream?> TryGetClipAsync(
            string frigateEventId, TimeSpan finalizationWindow = default, CancellationToken ct = default)
            => Task.FromResult(Clip);
    }
}
