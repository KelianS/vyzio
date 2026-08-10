using NSubstitute;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Vyzio.Application.UseCases.Frigate;
using Vyzio.Application.UseCases.Notifications;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Notifications;
using Vyzio.Infrastructure.Persistence;
using Vyzio.Infrastructure.Persistence.Repositories;

namespace Vyzio.Tests.Integration;

public sealed class FrigateNotificationFlowIntegrationTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly VyzioDbContext _db;
    private readonly NotificationRepository _notifications;
    private readonly RecordingChannelSender _telegram = new(NotificationChannel.Telegram);
    private readonly RecordingChannelSender _discord = new(NotificationChannel.Discord);
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
        _eventReader = new StubFrigateEventReader();
        _clipProvider = new StubClipProvider();

        var channelConfigs = new NotificationChannelConfigRepository(_db);
        foreach (var sender in new[] { _telegram, _discord })
        {
            channelConfigs.UpsertAsync(new NotificationChannelConfig
            {
                Channel = sender.Descriptor.Channel,
                IsEnabled = true,
                Credentials = sender.WorkingCredentials,
                MinimumConfidence = 0.75f
            }).GetAwaiter().GetResult();
        }

        var dispatcher = new SendDetectionNotificationUseCase(
            _notifications,
            new NotificationChannelCatalog([_telegram, _discord]),
            channelConfigs,
            Substitute.For<IFrigateEventImageProvider>(),
            _clipProvider,
            new DetectionMessageFormatter(),
            TimeZoneInfo.Local,
            NullLogger<SendDetectionNotificationUseCase>.Instance,
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
        Assert.Empty(_telegram.Sent);
        Assert.Empty(_discord.Sent);
    }

    [Fact]
    public async Task ExecuteAsync_sends_notification_with_clip_on_end()
    {
        _eventReader.Identity = "Alice";
        _clipProvider.Clip = new MemoryStream(new byte[] { 1, 2, 3 });

        await IngestAndNotifyAsync(Payload("frigate-ti-002", lifecycle: "end", topScore: 0.97f, hasClip: true));

        // One detection, both channels, and one journal entry each.
        Assert.Equal(2, await _db.Notifications.CountAsync());
        Assert.Single(_telegram.WithVideo);
        Assert.Single(_discord.WithVideo);

        var notification = await _db.Notifications.FirstAsync(n => n.Channel == NotificationChannel.Discord);
        Assert.Equal(NotificationStatus.Sent, notification.Status);
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

        Assert.Equal(2, await _db.Notifications.CountAsync());
        Assert.Single(_telegram.TextOnly);
        Assert.Single(_discord.TextOnly);
    }

    [Fact]
    public async Task ExecuteAsync_ignores_filtered_labels_without_notifying()
    {
        var processed = await IngestAndNotifyAsync(Payload("frigate-ti-004", label: "cat", lifecycle: "end", topScore: 0.91f));

        Assert.False(processed);
        Assert.Equal(0, await _db.Notifications.CountAsync());
        Assert.Empty(_telegram.Sent);
        Assert.Empty(_discord.Sent);
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

    /// <summary>Stands in for a real channel: records what it was handed, never how it would render it.</summary>
    private sealed class RecordingChannelSender(NotificationChannel channel) : INotificationChannelSender
    {
        public List<OutgoingNotification> Sent { get; } = [];

        public List<OutgoingNotification> WithVideo => [.. Sent.Where(n => n.Video is not null)];

        public List<OutgoingNotification> TextOnly => [.. Sent.Where(n => n.Video is null && n.Photo is null)];

        public NotificationChannelDescriptor Descriptor { get; } = new(
            channel,
            channel.ToString(),
            new ChannelCapabilities(Photo: true, Video: true, GroupedMedia: true, Buttons: false, UsefulTextLength: 1024),
            [new ChannelCredentialSpec(ChannelCredential.WebhookUrl, Secret: true)]);

        public ChannelCredentials WorkingCredentials { get; } = new(new Dictionary<ChannelCredential, string>
        {
            [ChannelCredential.WebhookUrl] = "https://channel.test/hook"
        });

        public Task SendAsync(OutgoingNotification notification, ChannelCredentials credentials, CancellationToken ct = default)
        {
            Sent.Add(notification);
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
