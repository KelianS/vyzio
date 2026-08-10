using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Application.UseCases.Notifications;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Notifications;

namespace Vyzio.Tests.UseCases;

public class SendDetectionNotificationUseCaseTests
{
    private readonly INotificationRepository _notifications = Substitute.For<INotificationRepository>();
    private readonly INotificationChannelConfigRepository _channelConfigs = Substitute.For<INotificationChannelConfigRepository>();
    private readonly IFrigateEventImageProvider _imageProvider = Substitute.For<IFrigateEventImageProvider>();
    private readonly IFrigateClipProvider _clipProvider = Substitute.For<IFrigateClipProvider>();
    private readonly INotificationChannelSender _telegram = FakeSender(NotificationChannel.Telegram);
    private readonly INotificationChannelSender _discord = FakeSender(NotificationChannel.Discord);

    private static NotificationChannelConfig ActiveConfig(NotificationChannel channel = NotificationChannel.Telegram)
        => new()
        {
            Channel = channel,
            IsEnabled = true,
            Credentials = Credentials(channel),
            MinimumConfidence = 0.75f
        };

    private static ChannelCredentials Credentials(NotificationChannel channel)
        => channel == NotificationChannel.Telegram
            ? new ChannelCredentials(new Dictionary<ChannelCredential, string>
            {
                [ChannelCredential.BotToken] = "bot-token",
                [ChannelCredential.ChatId] = "chat-id"
            })
            : new ChannelCredentials(new Dictionary<ChannelCredential, string>
            {
                [ChannelCredential.WebhookUrl] = "https://discord.test/hook"
            });

    private static INotificationChannelSender FakeSender(
        NotificationChannel channel,
        bool video = true,
        bool photo = true)
    {
        var sender = Substitute.For<INotificationChannelSender>();
        sender.Descriptor.Returns(new NotificationChannelDescriptor(
            channel,
            channel.ToString(),
            new ChannelCapabilities(photo, video, GroupedMedia: true, Buttons: false, UsefulTextLength: 1024),
            channel == NotificationChannel.Telegram
                ? new ChannelTransport([new ChannelCredentialSpec(ChannelCredential.BotToken, true),
                                        new ChannelCredentialSpec(ChannelCredential.ChatId, false)])
                : new ChannelTransport([new ChannelCredentialSpec(ChannelCredential.WebhookUrl, true)])));
        return sender;
    }

    private SendDetectionNotificationUseCase Build(params INotificationChannelSender[] senders)
        => new(
            _notifications,
            new NotificationChannelCatalog(senders),
            _channelConfigs,
            _imageProvider,
            _clipProvider,
            new DetectionMessageFormatter(),
            TimeZoneInfo.Local,
            NullLogger<SendDetectionNotificationUseCase>.Instance,
            mediaFinalizationWindow: TimeSpan.Zero);

    private void Configure(params NotificationChannelConfig[] configs)
        => _channelConfigs.GetAllAsync(Arg.Any<CancellationToken>()).Returns(configs);

    public SendDetectionNotificationUseCaseTests() => Configure(ActiveConfig());

    [Fact]
    public async Task Execute_carries_clip_and_snapshot_when_both_available()
    {
        var detection = CreateDetection();
        var clip = new MemoryStream([1, 2, 3]);
        var snapshot = new MemoryStream([4, 5, 6]);
        _clipProvider.TryGetClipAsync("frigate-evt-900", Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>()).Returns(clip);
        _imageProvider.TryGetImageAsync("frigate-evt-900", FrigateEventImage.Snapshot, Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>()).Returns(snapshot);

        var sent = await Build(_telegram).ExecuteAsync(detection);

        Assert.True(sent);
        await _telegram.Received(1).SendAsync(
            Arg.Is<OutgoingNotification>(n => n.Photo == snapshot && n.Video == clip),
            Arg.Any<ChannelCredentials>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_carries_the_clip_alone_when_no_snapshot()
    {
        var clip = new MemoryStream([1, 2, 3]);
        _clipProvider.TryGetClipAsync("frigate-evt-900", Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>()).Returns(clip);
        _imageProvider.TryGetImageAsync(Arg.Any<string>(), FrigateEventImage.Snapshot, Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>()).Returns((Stream?)null);

        var sent = await Build(_telegram).ExecuteAsync(CreateDetection());

        Assert.True(sent);
        await _telegram.Received(1).SendAsync(
            Arg.Is<OutgoingNotification>(n => n.Photo == null && n.Video == clip),
            Arg.Any<ChannelCredentials>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_falls_back_to_the_snapshot_when_the_clip_is_unavailable()
    {
        _clipProvider.TryGetClipAsync(Arg.Any<string>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>()).Returns((Stream?)null);
        var snapshot = new MemoryStream([1, 2, 3]);
        _imageProvider.TryGetImageAsync("frigate-evt-900", FrigateEventImage.Snapshot, Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>()).Returns(snapshot);

        var sent = await Build(_telegram).ExecuteAsync(CreateDetection());

        Assert.True(sent);
        await _telegram.Received(1).SendAsync(
            Arg.Is<OutgoingNotification>(n => n.Photo == snapshot && n.Video == null),
            Arg.Any<ChannelCredentials>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_sends_text_only_when_no_media_at_all()
    {
        _clipProvider.TryGetClipAsync(Arg.Any<string>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>()).Returns((Stream?)null);
        _imageProvider.TryGetImageAsync(Arg.Any<string>(), FrigateEventImage.Snapshot, Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>()).Returns((Stream?)null);

        var sent = await Build(_telegram).ExecuteAsync(CreateDetection());

        Assert.True(sent);
        await _telegram.Received(1).SendAsync(
            Arg.Is<OutgoingNotification>(n => n.Photo == null && n.Video == null),
            Arg.Any<ChannelCredentials>(),
            Arg.Any<CancellationToken>());
    }

    // The completion bar of the channel generalization: one detection, every configured channel,
    // and nothing in the use case that names either of them (ADR-50).
    [Fact]
    public async Task Execute_sends_the_same_detection_on_every_configured_channel()
    {
        Configure(ActiveConfig(NotificationChannel.Telegram), ActiveConfig(NotificationChannel.Discord));
        _clipProvider.TryGetClipAsync(Arg.Any<string>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>()).Returns((Stream?)null);
        _imageProvider.TryGetImageAsync(Arg.Any<string>(), FrigateEventImage.Snapshot, Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>()).Returns((Stream?)null);

        var sent = await Build(_telegram, _discord).ExecuteAsync(CreateDetection(identity: "Alice"));

        Assert.True(sent);
        foreach (var sender in new[] { _telegram, _discord })
        {
            await sender.Received(1).SendAsync(
                Arg.Is<OutgoingNotification>(n => n.Message.Headline.Contains("Alice detectee")),
                Arg.Any<ChannelCredentials>(),
                Arg.Any<CancellationToken>());
        }
    }

    [Fact]
    public async Task Execute_never_hands_a_clip_to_a_channel_that_cannot_carry_video()
    {
        var textOnly = FakeSender(NotificationChannel.Discord, video: false, photo: false);
        Configure(ActiveConfig(NotificationChannel.Discord));
        _clipProvider.TryGetClipAsync(Arg.Any<string>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(new MemoryStream([1, 2, 3]));

        await Build(textOnly).ExecuteAsync(CreateDetection());

        await _clipProvider.DidNotReceive().TryGetClipAsync(
            Arg.Any<string>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>());
        await textOnly.Received(1).SendAsync(
            Arg.Is<OutgoingNotification>(n => n.Photo == null && n.Video == null),
            Arg.Any<ChannelCredentials>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_skips_duplicate_notifications_for_the_same_event()
    {
        var detection = CreateDetection();
        _notifications.HasSentAsync(detection.EventId, NotificationChannel.Telegram, Arg.Any<CancellationToken>()).Returns(true);

        var sent = await Build(_telegram).ExecuteAsync(detection);

        Assert.False(sent);
        await _telegram.DidNotReceive().SendAsync(
            Arg.Any<OutgoingNotification>(), Arg.Any<ChannelCredentials>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_skips_when_no_channel_is_configured()
    {
        Configure();

        var sent = await Build(_telegram).ExecuteAsync(CreateDetection());

        Assert.False(sent);
        await _telegram.DidNotReceive().SendAsync(
            Arg.Any<OutgoingNotification>(), Arg.Any<ChannelCredentials>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_skips_a_channel_missing_a_credential_it_declared()
    {
        Configure(new NotificationChannelConfig
        {
            Channel = NotificationChannel.Telegram,
            IsEnabled = true,
            Credentials = new ChannelCredentials(new Dictionary<ChannelCredential, string>
            {
                [ChannelCredential.BotToken] = "bot-token"
            })
        });

        var sent = await Build(_telegram).ExecuteAsync(CreateDetection());

        Assert.False(sent);
        await _telegram.DidNotReceive().SendAsync(
            Arg.Any<OutgoingNotification>(), Arg.Any<ChannelCredentials>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_skips_when_the_channel_is_disabled()
    {
        var config = ActiveConfig();
        config.IsEnabled = false;
        Configure(config);

        var sent = await Build(_telegram).ExecuteAsync(CreateDetection());

        Assert.False(sent);
        await _telegram.DidNotReceive().SendAsync(
            Arg.Any<OutgoingNotification>(), Arg.Any<ChannelCredentials>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_records_a_failed_notification_when_the_channel_refuses()
    {
        var detection = CreateDetection();
        _clipProvider.TryGetClipAsync(Arg.Any<string>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>()).Returns((Stream?)null);
        _imageProvider.TryGetImageAsync(Arg.Any<string>(), FrigateEventImage.Snapshot, Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>()).Returns((Stream?)null);
        _telegram.SendAsync(Arg.Any<OutgoingNotification>(), Arg.Any<ChannelCredentials>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new HttpRequestException("channel unavailable")));

        var sent = await Build(_telegram).ExecuteAsync(detection);

        Assert.False(sent);
        await _notifications.Received(1).AddAsync(
            Arg.Is<Notification>(n =>
                n.FrigateEventId == detection.EventId
                && n.Channel == NotificationChannel.Telegram
                && n.Status == NotificationStatus.Failed
                && n.ErrorMessage == "channel unavailable"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_skips_below_minimum_confidence()
    {
        var sent = await Build(_telegram).ExecuteAsync(CreateDetection(confidence: 0.5f));

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
        => Assert.Equal(expected, SendDetectionNotificationUseCase.IsWithinActiveHours(hour, from, to));

    private static DateTimeOffset LocalTime(int year, int month, int day, int hour, int minute) =>
        new(year, month, day, hour, minute, 0, TimeZoneInfo.Local.GetUtcOffset(new DateTime(year, month, day, hour, minute, 0)));

    private static FrigateDetection CreateDetection(
        float confidence = 0.91f,
        string label = "person",
        string? identity = "Alice",
        bool hasClip = true,
        bool hasSnapshot = true)
        => new(
            "frigate-evt-900",
            "front_door",
            label,
            identity,
            confidence,
            LocalTime(2026, 5, 10, 10, 15),
            hasClip,
            hasSnapshot);
}

public class LabelRoutingTests
{
    [Theory]
    [InlineData("person", null,    "person_unknown")]
    [InlineData("person", "",      "person_unknown")]
    [InlineData("person", "Alice", "person_known")]
    [InlineData("face",   null,    "person_unknown")]
    [InlineData("face",   "Alice", "person_known")]
    [InlineData("FACE",   "Alice", "person_known")]
    [InlineData("car",    null,    "car")]
    [InlineData("car",    "Alice", "car")]
    [InlineData("dog",    null,    "dog")]
    public void ResolveNotificationLabel_maps_correctly(string label, string? identity, string expected)
        => Assert.Equal(expected, SendDetectionNotificationUseCase.ResolveNotificationLabel(label, identity));

    [Theory]
    // person events
    [InlineData("person", null,    new[] { "person_unknown", "person_known" }, true)]
    [InlineData("person", "Alice", new[] { "person_unknown", "person_known" }, true)]
    [InlineData("person", null,    new[] { "person_known" },                  false)]
    [InlineData("person", "Alice", new[] { "person_unknown" },                false)]
    // face events — same resolution as person
    [InlineData("face",   null,    new[] { "person_unknown" },                true)]
    [InlineData("face",   "Alice", new[] { "person_known" },                  true)]
    [InlineData("face",   null,    new[] { "person_known" },                  false)]
    [InlineData("face",   "Alice", new[] { "person_unknown" },                false)]
    // other labels
    [InlineData("car",    null,    new[] { "car" },                           true)]
    [InlineData("car",    null,    new[] { "person_unknown", "person_known" },false)]
    public void IsLabelAllowed_routes_correctly(string label, string? identity, string[] allowed, bool expected)
    {
        var allowedSet = new HashSet<string>(allowed, StringComparer.OrdinalIgnoreCase);
        Assert.Equal(expected, SendDetectionNotificationUseCase.IsLabelAllowed(label, identity, allowedSet));
    }
}

public class DetectionMessageFormatterTests
{
    private readonly DetectionMessageFormatter _sut = new();

    private static FrigateDetection EventWith(
        string camera = "front_door",
        string label = "person",
        string? identity = null,
        float confidence = 0.82f)
        => new(
            "f1",
            camera,
            label,
            identity,
            confidence,
            new DateTimeOffset(2026, 5, 10, 8, 30, 0,
                TimeZoneInfo.Local.GetUtcOffset(new DateTime(2026, 5, 10, 8, 30, 0))),
            HasClip: false,
            HasSnapshot: true);

    private static string Flatten(ChannelMessage message)
        => $"{message.Headline} {string.Join(" ", message.Details)}";

    [Fact]
    public void Format_all_fields_enabled_returns_all_parts()
    {
        var result = Flatten(_sut.Format(EventWith(identity: "Alice"), MessageFields.All));
        Assert.Contains("Alice detectee", result);
        Assert.Contains("front door", result);
        Assert.Contains("08:30", result);
        Assert.Contains("82 %", result);
    }

    [Fact]
    public void Format_without_camera_omits_camera_name()
    {
        var fields = MessageFields.All.Except([MessageField.Camera]).ToHashSet();
        Assert.DoesNotContain("front door", Flatten(_sut.Format(EventWith(), fields)));
    }

    [Fact]
    public void Format_without_time_omits_time()
    {
        var fields = MessageFields.All.Except([MessageField.Time]).ToHashSet();
        Assert.DoesNotContain("08:30", Flatten(_sut.Format(EventWith(), fields)));
    }

    [Fact]
    public void Format_without_confidence_omits_percentage()
    {
        var fields = MessageFields.All.Except([MessageField.Confidence]).ToHashSet();
        Assert.DoesNotContain("%", Flatten(_sut.Format(EventWith(), fields)));
    }

    [Fact]
    public void Format_without_label_uses_generic_subject()
    {
        var result = Flatten(_sut.Format(EventWith(), new HashSet<MessageField> { MessageField.Camera }));
        Assert.Contains("Detection", result);
        Assert.DoesNotContain("person", result);
    }

    [Fact]
    public void Format_null_fields_defaults_to_all()
    {
        var result = Flatten(_sut.Format(EventWith(identity: "Bob")));
        Assert.Contains("Bob detectee", result);
        Assert.Contains("front door", result);
        Assert.Contains("08:30", result);
    }

    // The message leaves the domain without markup: emphasis is the channel's business (ADR-50).
    [Fact]
    public void Format_never_emits_markup()
    {
        var message = _sut.Format(EventWith(identity: "Alice"));
        Assert.DoesNotContain("<b>", message.Headline);
        Assert.DoesNotContain("**", message.Headline);
    }
}
