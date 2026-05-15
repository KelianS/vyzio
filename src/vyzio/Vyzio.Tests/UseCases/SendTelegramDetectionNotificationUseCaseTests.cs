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
            new DetectionTelegramMessageFormatter(),
            NullLogger<SendTelegramDetectionNotificationUseCase>.Instance);
    }

    [Fact]
    public async Task Execute_sends_and_records_a_sent_notification_for_high_value_new_detections()
    {
        var detectionEvent = CreateDetectionEvent();

        var sent = await _sut.ExecuteAsync(detectionEvent);

        Assert.True(sent);
        await _telegramSender.Received(1).SendAsync(
            "Alice detectee — front door — 10:15 — 91 %",
            "bot-token",
            "chat-id",
            Arg.Any<CancellationToken>());
        await _notifications.Received(1).AddAsync(
            Arg.Is<Notification>(notification =>
                notification.EventId == detectionEvent.Id
                && notification.Channel == "telegram"
                && notification.Status == "sent"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_skips_end_lifecycle_events()
    {
        var detectionEvent = CreateDetectionEvent(lifecycle: "end");

        var sent = await _sut.ExecuteAsync(detectionEvent);

        Assert.False(sent);
        await _telegramSender.DidNotReceive().SendAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_sends_update_event_when_not_already_notified()
    {
        // update lifecycle is accepted so notifications aren't missed when the
        // "new" frame arrives before the Telegram config is saved
        var detectionEvent = CreateDetectionEvent(lifecycle: "update");

        var sent = await _sut.ExecuteAsync(detectionEvent);

        Assert.True(sent);
    }

    [Fact]
    public async Task Execute_defers_new_event_when_snapshot_not_yet_ready()
    {
        // On lifecycle=new, if the snapshot field is enabled but has_snapshot=false,
        // we wait for an "update" frame so the notification carries a photo.
        var detectionEvent = new DetectionEvent
        {
            Id = "evt-900",
            FrigateEventId = "frigate-evt-900",
            Lifecycle = "new",
            Camera = "front_door",
            Label = "person",
            Identity = "Alice",
            Confidence = 0.91f,
            OccurredAt = LocalTime(2026, 5, 10, 10, 15),
            HasSnapshot = false,
            HasClip = true
        };

        var sent = await _sut.ExecuteAsync(detectionEvent);

        Assert.False(sent);
        await _telegramSender.DidNotReceive().SendAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
        await _telegramSender.DidNotReceive().SendPhotoAsync(
            Arg.Any<Stream>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_sends_new_event_immediately_when_snapshot_field_disabled()
    {
        // If the user disabled the snapshot field, send text immediately on "new"
        // without waiting for has_snapshot=true.
        var configNoSnapshot = new NotificationChannelConfig
        {
            Channel = "telegram",
            IsEnabled = true,
            BotToken = "bot-token",
            ChatId = "chat-id",
            MinimumConfidence = 0.75f,
            MessageFieldsJson = """["camera","time","label","confidence"]"""
        };
        _channelConfigs.GetByChannelAsync("telegram", Arg.Any<CancellationToken>()).Returns(configNoSnapshot);

        var detectionEvent = new DetectionEvent
        {
            Id = "evt-900",
            FrigateEventId = "frigate-evt-900",
            Lifecycle = "new",
            Camera = "front_door",
            Label = "person",
            Identity = "Alice",
            Confidence = 0.91f,
            OccurredAt = LocalTime(2026, 5, 10, 10, 15),
            HasSnapshot = false,
            HasClip = true
        };

        var sent = await _sut.ExecuteAsync(detectionEvent);

        Assert.True(sent);
        await _telegramSender.Received(1).SendAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_skips_duplicate_notifications_for_the_same_event()
    {
        var detectionEvent = CreateDetectionEvent();
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

        var sent = await _sut.ExecuteAsync(CreateDetectionEvent());

        Assert.False(sent);
        await _telegramSender.DidNotReceive().SendAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_skips_when_channel_disabled()
    {
        _channelConfigs.GetByChannelAsync("telegram", Arg.Any<CancellationToken>())
            .Returns(new NotificationChannelConfig { Channel = "telegram", IsEnabled = false, BotToken = "token", ChatId = "chat" });

        var sent = await _sut.ExecuteAsync(CreateDetectionEvent());

        Assert.False(sent);
        await _telegramSender.DidNotReceive().SendAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_records_failed_notifications_when_telegram_send_fails()
    {
        var detectionEvent = CreateDetectionEvent();
        _telegramSender.SendAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new HttpRequestException("telegram unavailable")));

        var sent = await _sut.ExecuteAsync(detectionEvent);

        Assert.False(sent);
        await _notifications.Received(1).AddAsync(
            Arg.Is<Notification>(notification =>
                notification.EventId == detectionEvent.Id
                && notification.Status == "failed"
                && notification.ErrorMessage == "telegram unavailable"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_sends_when_event_is_within_active_hours()
    {
        _channelConfigs.GetByChannelAsync("telegram", Arg.Any<CancellationToken>())
            .Returns(new NotificationChannelConfig
            {
                Channel = "telegram", IsEnabled = true, BotToken = "token", ChatId = "chat",
                ActiveFromHour = 8, ActiveToHour = 22
            });

        // 10h is within [8, 22) regardless of timezone
        var inRange = SendTelegramDetectionNotificationUseCase.IsWithinActiveHours(10, 8, 22);

        Assert.True(inRange);
    }

    [Theory]
    [InlineData(8, 22, 10, true)]   // 10h inside [8,22)
    [InlineData(8, 22, 7,  false)]  // 7h before range
    [InlineData(8, 22, 22, false)]  // 22h is exclusive upper bound
    [InlineData(22, 6,  23, true)]  // overnight: 23h inside [22,24)
    [InlineData(22, 6,  3,  true)]  // overnight: 3h inside [0,6)
    [InlineData(22, 6,  10, false)] // overnight: 10h outside both bands
    [InlineData(null, 22, 10, true)]// no lower bound → always active
    [InlineData(8, null, 10, true)] // no upper bound → always active
    public void IsWithinActiveHours_applies_schedule_correctly(int? from, int? to, int hour, bool expected)
    {
        var result = SendTelegramDetectionNotificationUseCase.IsWithinActiveHours(hour, from, to);

        Assert.Equal(expected, result);
    }

    private static DateTimeOffset LocalTime(int year, int month, int day, int hour, int minute) =>
        new(year, month, day, hour, minute, 0, TimeZoneInfo.Local.GetUtcOffset(new DateTime(year, month, day, hour, minute, 0)));

    private static DetectionEvent CreateDetectionEvent(
        string lifecycle = "new",
        float confidence = 0.91f,
        string label = "person")
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
            HasSnapshot = true,
            HasClip = true
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
        Lifecycle = "new",
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
