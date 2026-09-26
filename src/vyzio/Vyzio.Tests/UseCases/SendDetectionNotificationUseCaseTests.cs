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
                [ChannelCredential.ChatId] = "4242"
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
                : new ChannelTransport([new ChannelCredentialSpec(ChannelCredential.ChatId, true)])));
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
    public async Task ExecuteAsync_ShouldCarryTheClipAndTheSnapshot_WhenBothAreAvailable()
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
    public async Task ExecuteAsync_ShouldCarryTheClipAlone_WhenThereIsNoSnapshot()
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
    public async Task ExecuteAsync_ShouldFallBackToTheSnapshot_WhenTheClipIsUnavailable()
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
    public async Task ExecuteAsync_ShouldSendTextOnly_WhenThereIsNoMediaAtAll()
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
    public async Task ExecuteAsync_ShouldSendTheSameDetectionOnEveryChannel_WhenSeveralChannelsAreConfigured()
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
    public async Task ExecuteAsync_ShouldNeverFetchOrHandAClip_WhenTheChannelCannotCarryVideo()
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
    public async Task ExecuteAsync_ShouldSendNothing_WhenTheEventWasAlreadyNotifiedOnTheChannel()
    {
        var detection = CreateDetection();
        _notifications.HasSentAsync(detection.EventId, NotificationChannel.Telegram, Arg.Any<CancellationToken>()).Returns(true);

        var sent = await Build(_telegram).ExecuteAsync(detection);

        Assert.False(sent);
        await _telegram.DidNotReceive().SendAsync(
            Arg.Any<OutgoingNotification>(), Arg.Any<ChannelCredentials>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldSendNothing_WhenNoChannelIsConfigured()
    {
        Configure();

        var sent = await Build(_telegram).ExecuteAsync(CreateDetection());

        Assert.False(sent);
        await _telegram.DidNotReceive().SendAsync(
            Arg.Any<OutgoingNotification>(), Arg.Any<ChannelCredentials>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldSkipTheChannel_WhenACredentialItDeclaresIsMissing()
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
    public async Task ExecuteAsync_ShouldSendNothing_WhenTheChannelIsDisabled()
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
    public async Task ExecuteAsync_ShouldRecordAFailedNotification_WhenTheChannelRefuses()
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
    public async Task ExecuteAsync_ShouldSendNothing_WhenTheConfidenceIsBelowTheMinimum()
    {
        var sent = await Build(_telegram).ExecuteAsync(CreateDetection(confidence: 0.5f));

        Assert.False(sent);
    }

#pragma warning disable format // Aligned as a table so each row reads against the others.
    [Theory]
    [InlineData(8, 22, 10, true)]
    [InlineData(8, 22, 7,  false)]
    [InlineData(8, 22, 22, false)]
    [InlineData(22, 6,  23, true)]
    [InlineData(22, 6,  3,  true)]
    [InlineData(22, 6,  10, false)]
    [InlineData(null, 22, 10, true)]
    [InlineData(8, null, 10, true)]
    public void IsWithinActiveHours_ShouldTellWhetherTheHourIsActive_WhenTheWindowIsPlainWrapsMidnightOrIsHalfSet(int? from, int? to, int hour, bool expected)
        => Assert.Equal(expected, SendDetectionNotificationUseCase.IsWithinActiveHours(hour, from, to));
#pragma warning restore format

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
#pragma warning disable format // Aligned as a table so each row reads against the others.
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
    public void ResolveNotificationLabel_ShouldSplitPersonsByIdentityAndKeepOtherLabels_WhenMappingADetection(string label, string? identity, string expected)
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
    public void IsLabelAllowed_ShouldAllowOnlyAResolvedLabelInTheSet_WhenRoutingADetection(string label, string? identity, string[] allowed, bool expected)
    {
        var allowedSet = new HashSet<string>(allowed, StringComparer.OrdinalIgnoreCase);
        Assert.Equal(expected, SendDetectionNotificationUseCase.IsLabelAllowed(label, identity, allowedSet));
    }
#pragma warning restore format
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
    public void Format_ShouldIncludeEveryPart_WhenEveryFieldIsEnabled()
    {
        var result = Flatten(_sut.Format(EventWith(identity: "Alice"), MessageFields.All));
        Assert.Contains("Alice detectee", result);
        Assert.Contains("front door", result);
        Assert.Contains("08:30", result);
        Assert.Contains("82 %", result);
    }

    [Fact]
    public void Format_ShouldOmitTheCameraName_WhenTheCameraFieldIsDisabled()
    {
        var fields = MessageFields.All.Except([MessageField.Camera]).ToHashSet();
        Assert.DoesNotContain("front door", Flatten(_sut.Format(EventWith(), fields)));
    }

    [Fact]
    public void Format_ShouldOmitTheTime_WhenTheTimeFieldIsDisabled()
    {
        var fields = MessageFields.All.Except([MessageField.Time]).ToHashSet();
        Assert.DoesNotContain("08:30", Flatten(_sut.Format(EventWith(), fields)));
    }

    [Fact]
    public void Format_ShouldOmitThePercentage_WhenTheConfidenceFieldIsDisabled()
    {
        var fields = MessageFields.All.Except([MessageField.Confidence]).ToHashSet();
        Assert.DoesNotContain("%", Flatten(_sut.Format(EventWith(), fields)));
    }

    [Fact]
    public void Format_ShouldUseAGenericSubject_WhenTheLabelFieldIsDisabled()
    {
        var result = Flatten(_sut.Format(EventWith(), new HashSet<MessageField> { MessageField.Camera }));
        Assert.Contains("Detection", result);
        Assert.DoesNotContain("person", result);
    }

    [Fact]
    public void Format_ShouldIncludeEveryField_WhenNoFieldSetIsGiven()
    {
        var result = Flatten(_sut.Format(EventWith(identity: "Bob")));
        Assert.Contains("Bob detectee", result);
        Assert.Contains("front door", result);
        Assert.Contains("08:30", result);
    }

    // The message leaves the domain without markup: emphasis is the channel's business (ADR-50).
    [Fact]
    public void Format_ShouldEmitNoMarkup_WhenTheHeadlineNamesAnIdentity()
    {
        var message = _sut.Format(EventWith(identity: "Alice"));
        Assert.DoesNotContain("<b>", message.Headline);
        Assert.DoesNotContain("**", message.Headline);
    }
}
