using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Application.UseCases.Notifications;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class SendTelegramDetectionNotificationUseCaseTests
{
    private readonly INotificationRepository _notifications = Substitute.For<INotificationRepository>();
    private readonly ITelegramNotificationSender _telegramSender = Substitute.For<ITelegramNotificationSender>();
    private readonly INotificationChannelConfigRepository _channelConfigs = Substitute.For<INotificationChannelConfigRepository>();
    private readonly IFrigateSnapshotProvider _snapshotProvider = Substitute.For<IFrigateSnapshotProvider>();
    private readonly IFrigateClipProvider _clipProvider = Substitute.For<IFrigateClipProvider>();
    private readonly SendTelegramDetectionNotificationUseCase _sut;

    private static NotificationChannelConfig ActiveTelegramConfig => new()
    {
        Channel = "telegram",
        IsEnabled = true,
        BotToken = "bot-token",
        ChatId = "chat-id",
        MinimumConfidence = 0.75f
    };

    public SendTelegramDetectionNotificationUseCaseTests()
    {
        _channelConfigs.GetByChannelAsync("telegram", Arg.Any<CancellationToken>())
            .Returns(ActiveTelegramConfig);

        _sut = new SendTelegramDetectionNotificationUseCase(
            _notifications,
            _telegramSender,
            _channelConfigs,
            _snapshotProvider,
            _clipProvider,
            new DetectionTelegramMessageFormatter(),
            NullLogger<SendTelegramDetectionNotificationUseCase>.Instance);
    }

    [Fact]
    public async Task Execute_sends_video_on_end_when_has_clip_true()
    {
        var detectionEvent = CreateDetectionEvent(lifecycle: "end", hasClip: true);
        var clipStream = new MemoryStream(new byte[] { 1, 2, 3 });
        _clipProvider.TryGetClipAsync("frigate-evt-900", Arg.Any<CancellationToken>()).Returns(clipStream);

        var sent = await _sut.ExecuteAsync(detectionEvent);

        Assert.True(sent);
        await _telegramSender.Received(1).SendVideoAsync(
            clipStream,
            Arg.Any<string>(),
            "bot-token",
            "chat-id",
            Arg.Any<CancellationToken>());
        await _telegramSender.DidNotReceive().SendPhotoAsync(
            Arg.Any<Stream>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_falls_back_to_snapshot_on_end_when_clip_unavailable()
    {
        var detectionEvent = CreateDetectionEvent(lifecycle: "end", hasClip: true, hasSnapshot: true);
        _clipProvider.TryGetClipAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((Stream?)null);
        var snapshotStream = new MemoryStream(new byte[] { 1, 2, 3 });
        _snapshotProvider.TryGetSnapshotAsync("frigate-evt-900", Arg.Any<CancellationToken>()).Returns(snapshotStream);

        var sent = await _sut.ExecuteAsync(detectionEvent);

        Assert.True(sent);
        await _telegramSender.Received(1).SendPhotoAsync(
            snapshotStream,
            Arg.Any<string>(),
            "bot-token",
            "chat-id",
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_sends_photo_on_end_when_has_clip_false_but_has_snapshot_true()
    {
        var detectionEvent = CreateDetectionEvent(lifecycle: "end", hasClip: false, hasSnapshot: true);
        var snapshotStream = new MemoryStream(new byte[] { 1, 2, 3 });
        _snapshotProvider.TryGetSnapshotAsync("frigate-evt-900", Arg.Any<CancellationToken>()).Returns(snapshotStream);

        var sent = await _sut.ExecuteAsync(detectionEvent);

        Assert.True(sent);
        await _telegramSender.Received(1).SendPhotoAsync(
            snapshotStream,
            Arg.Any<string>(),
            "bot-token",
            "chat-id",
            Arg.Any<CancellationToken>());
        await _clipProvider.DidNotReceive().TryGetClipAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_sends_text_on_end_when_neither_clip_nor_snapshot()
    {
        var detectionEvent = CreateDetectionEvent(lifecycle: "end", hasClip: false, hasSnapshot: false);

        var sent = await _sut.ExecuteAsync(detectionEvent);

        Assert.True(sent);
        await _telegramSender.Received(1).SendAsync(
            Arg.Any<string>(), "bot-token", "chat-id", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_skips_new_lifecycle()
    {
        var detectionEvent = CreateDetectionEvent(lifecycle: "new");

        var sent = await _sut.ExecuteAsync(detectionEvent);

        Assert.False(sent);
        await _telegramSender.DidNotReceive().SendAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_skips_update_lifecycle()
    {
        var detectionEvent = CreateDetectionEvent(lifecycle: "update");

        var sent = await _sut.ExecuteAsync(detectionEvent);

        Assert.False(sent);
        await _telegramSender.DidNotReceive().SendAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_skips_duplicate_notifications_for_the_same_event()
    {
        var detectionEvent = CreateDetectionEvent(lifecycle: "end");
        _notifications.HasSentAsync(detectionEvent.Id, "telegram", Arg.Any<CancellationToken>()).Returns(true);

        var sent = await _sut.ExecuteAsync(detectionEvent);

        Assert.False(sent);
        await _telegramSender.DidNotReceive().SendAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_skips_when_channel_not_configured()
    {
        _channelConfigs.GetByChannelAsync("telegram", Arg.Any<CancellationToken>())
            .Returns((NotificationChannelConfig?)null);

        var sent = await _sut.ExecuteAsync(CreateDetectionEvent(lifecycle: "end"));

        Assert.False(sent);
        await _telegramSender.DidNotReceive().SendAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_skips_when_channel_disabled()
    {
        _channelConfigs.GetByChannelAsync("telegram", Arg.Any<CancellationToken>())
            .Returns(new NotificationChannelConfig { Channel = "telegram", IsEnabled = false, BotToken = "token", ChatId = "chat" });

        var sent = await _sut.ExecuteAsync(CreateDetectionEvent(lifecycle: "end"));

        Assert.False(sent);
        await _telegramSender.DidNotReceive().SendAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_records_failed_notifications_when_telegram_send_fails()
    {
        var detectionEvent = CreateDetectionEvent(lifecycle: "end", hasClip: false, hasSnapshot: false);
        _telegramSender.SendAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new HttpRequestException("telegram unavailable")));

        var sent = await _sut.ExecuteAsync(detectionEvent);

        Assert.False(sent);
        await _notifications.Received(1).AddAsync(
            Arg.Is<Notification>(n =>
                n.EventId == detectionEvent.Id
                && n.Status == "failed"
                && n.ErrorMessage == "telegram unavailable"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_skips_below_minimum_confidence()
    {
        var detectionEvent = CreateDetectionEvent(lifecycle: "end", confidence: 0.5f);

        var sent = await _sut.ExecuteAsync(detectionEvent);

        Assert.False(sent);
    }

    [Theory]
    [InlineData(8, 22, 10, true)]
    [InlineData(8, 22, 7,  false)]
    [InlineData(8, 22, 22, false)]
    [InlineData(22, 6,  23, true)]
    [InlineData(22, 6,  3,  true)]
    [InlineData(22, 6,  10, false)]
    [InlineData(null, 22, 10, true)]
    [InlineData(8, null, 10, true)]
    public void IsWithinActiveHours_applies_schedule_correctly(int? from, int? to, int hour, bool expected)
    {
        var result = SendTelegramDetectionNotificationUseCase.IsWithinActiveHours(hour, from, to);
        Assert.Equal(expected, result);
    }

    private static DateTimeOffset LocalTime(int year, int month, int day, int hour, int minute) =>
        new(year, month, day, hour, minute, 0, TimeZoneInfo.Local.GetUtcOffset(new DateTime(year, month, day, hour, minute, 0)));

    private static DetectionEvent CreateDetectionEvent(
        string lifecycle = "end",
        float confidence = 0.91f,
        string label = "person",
        bool hasClip = true,
        bool hasSnapshot = true)
        => new()
        {
            Id = "evt-900",
            FrigateEventId = "frigate-evt-900",
            Lifecycle = lifecycle,
            Camera = "front_door",
            Label = label,
            Identity = "Alice",
            Confidence = confidence,
            OccurredAt = LocalTime(2026, 5, 10, 10, 15),
            HasSnapshot = hasSnapshot,
            HasClip = hasClip
        };
}

public class DetectionTelegramMessageFormatterTests
{
    private readonly DetectionTelegramMessageFormatter _sut = new();

    private static DetectionEvent EventWith(
        string camera = "front_door",
        string label = "person",
        string? identity = null,
        float confidence = 0.82f) => new()
    {
        Id = "e1",
        FrigateEventId = "f1",
        Lifecycle = "end",
        Camera = camera,
        Label = label,
        Identity = identity,
        Confidence = confidence,
        OccurredAt = new DateTimeOffset(2026, 5, 10, 8, 30, 0,
            TimeZoneInfo.Local.GetUtcOffset(new DateTime(2026, 5, 10, 8, 30, 0))),
        HasSnapshot = true
    };

    [Fact]
    public void Format_all_fields_enabled_returns_all_parts()
    {
        var result = _sut.Format(EventWith(identity: "Alice"), MessageField.All);
        Assert.Contains("Alice detectee", result);
        Assert.Contains("front door", result);
        Assert.Contains("08:30", result);
        Assert.Contains("82 %", result);
    }

    [Fact]
    public void Format_without_camera_omits_camera_name()
    {
        var fields = new HashSet<string>(MessageField.All) { };
        fields.Remove(MessageField.Camera);
        var result = _sut.Format(EventWith(), fields);
        Assert.DoesNotContain("front door", result);
    }

    [Fact]
    public void Format_without_time_omits_time()
    {
        var fields = new HashSet<string>(MessageField.All);
        fields.Remove(MessageField.Time);
        var result = _sut.Format(EventWith(), fields);
        Assert.DoesNotContain("08:30", result);
    }

    [Fact]
    public void Format_without_confidence_omits_percentage()
    {
        var fields = new HashSet<string>(MessageField.All);
        fields.Remove(MessageField.Confidence);
        var result = _sut.Format(EventWith(), fields);
        Assert.DoesNotContain("%", result);
    }

    [Fact]
    public void Format_without_label_uses_generic_subject()
    {
        var fields = new HashSet<string> { MessageField.Camera };
        var result = _sut.Format(EventWith(), fields);
        Assert.StartsWith("Detection", result);
        Assert.DoesNotContain("person", result);
    }

    [Fact]
    public void Format_null_fields_defaults_to_all()
    {
        var result = _sut.Format(EventWith(identity: "Bob"));
        Assert.Contains("Bob detectee", result);
        Assert.Contains("front door", result);
        Assert.Contains("08:30", result);
    }
}
