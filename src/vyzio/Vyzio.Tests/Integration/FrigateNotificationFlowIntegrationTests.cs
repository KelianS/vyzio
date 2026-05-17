using NSubstitute;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Vyzio.Api.Integration.Frigate;
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
    private readonly DetectionEventRepository _detectionEvents;
    private readonly NotificationRepository _notifications;
    private readonly RecordingTelegramSender _telegramSender;
    private readonly StubFrigateRestClient _restClient;
    private readonly StubClipProvider _clipProvider;
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
            clipFetchDelaySeconds: 0);

        _sut = new FrigateAdapter(
            new FrigateEventContractAdapter(new FrigateLabelFilter(["person"])),
            _detectionEvents,
            dispatcher,
            _restClient,
            Substitute.For<IProfileRepository>(),
            Substitute.For<IProfileCameraLinkRepository>(),
            NullLogger<FrigateAdapter>.Instance);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task ProcessMessageAsync_persists_detection_on_new_event_without_notifying()
    {
        _restClient.Identity = "Alice";

        var processed = await _sut.ProcessMessageAsync("frigate/events", Payload("frigate-ti-001", lifecycle: "new", topScore: 0.97f));

        Assert.True(processed);

        var detection = await _db.DetectionEvents.SingleAsync();
        Assert.Equal("frigate-ti-001", detection.FrigateEventId);
        Assert.Equal("Alice", detection.Identity);
        Assert.Equal("new", detection.Lifecycle);

        // No notification yet — we wait for lifecycle=end.
        Assert.Equal(0, await _db.Notifications.CountAsync());
        Assert.Empty(_telegramSender.Messages);
    }

    [Fact]
    public async Task ProcessMessageAsync_sends_notification_with_clip_on_end()
    {
        _restClient.Identity = "Alice";
        _clipProvider.Clip = new MemoryStream(new byte[] { 1, 2, 3 });

        await _sut.ProcessMessageAsync("frigate/events", Payload("frigate-ti-002", lifecycle: "new", topScore: 0.97f, hasClip: false));
        await _sut.ProcessMessageAsync("frigate/events", Payload("frigate-ti-002", lifecycle: "end", topScore: 0.97f, hasClip: true));

        Assert.Equal(1, await _db.DetectionEvents.CountAsync());
        Assert.Equal(1, await _db.Notifications.CountAsync());
        // Snapshot provider returns null → media group not possible → video-only fallback
        Assert.Single(_telegramSender.Videos);
        Assert.Empty(_telegramSender.MediaGroups);
        Assert.Empty(_telegramSender.Messages);

        var notification = await _db.Notifications.SingleAsync();
        Assert.Equal("sent", notification.Status);
    }

    [Fact]
    public async Task ProcessMessageAsync_does_not_create_duplicate_notification_on_multiple_end_events()
    {
        _restClient.Identity = "Alice";

        await _sut.ProcessMessageAsync("frigate/events", Payload("frigate-ti-003", lifecycle: "end", hasClip: false));
        await _sut.ProcessMessageAsync("frigate/events", Payload("frigate-ti-003", lifecycle: "end", hasClip: false));

        Assert.Equal(1, await _db.Notifications.CountAsync());
        Assert.Single(_telegramSender.Messages);
    }

    [Fact]
    public async Task ProcessMessageAsync_ignores_filtered_labels_without_persisting_or_notifying()
    {
        var processed = await _sut.ProcessMessageAsync("frigate/events", Payload("frigate-ti-004", label: "cat", lifecycle: "new", topScore: 0.91f));

        Assert.False(processed);
        Assert.Equal(0, await _db.DetectionEvents.CountAsync());
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

    private sealed class StubFrigateRestClient : IFrigateRestClient
    {
        public string? Identity { get; set; }

        public Task<string?> TryGetIdentityAsync(string frigateEventId, CancellationToken ct = default)
            => Task.FromResult(Identity);

        public Task<HttpResponseMessage> GetLatestFrameAsync(string cameraSlug, CancellationToken ct = default)
            => Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK) { Content = new StreamContent(Stream.Null) });

        public Task<Stream?> GetClipStreamAsync(string frigateEventId, CancellationToken ct = default)
            => Task.FromResult<Stream?>(Stream.Null);
    }

    private sealed class StubClipProvider : IFrigateClipProvider
    {
        public Stream? Clip { get; set; }

        public Task<Stream?> TryGetClipAsync(string frigateEventId, CancellationToken ct = default)
            => Task.FromResult(Clip);
    }
}
