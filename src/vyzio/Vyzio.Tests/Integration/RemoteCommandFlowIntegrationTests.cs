using System.Net;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Application.Commands;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Application.UseCases.Commands;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Application.UseCases.Hub;
using Vyzio.Application.UseCases.Notifications;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Notifications;
using Vyzio.Infrastructure.Persistence;
using Vyzio.Infrastructure.Persistence.Repositories;

namespace Vyzio.Tests.Integration;

/// <summary>
/// The gate of the step, end to end: asking from one's phone answers, and a stranger asking the very
/// same thing gets nothing at all (ADR-50).
/// </summary>
public sealed class RemoteCommandFlowIntegrationTests : IDisposable
{
    private const string OwnerChat = "4242";
    private const string StrangerChat = "9999";

    private readonly SqliteConnection _connection;
    private readonly VyzioDbContext _db;
    private readonly ChannelPairingRepository _pairings;
    private readonly CommandJournalRepository _journal;
    private readonly FakeTelegram _telegram = new();
    private readonly TelegramCommandReceiver _receiver;
    private readonly RemoteCommandRegistry _registry;
    private readonly HandleIncomingCommandUseCase _sut;

    private static readonly ChannelCredentials Credentials = new(new Dictionary<ChannelCredential, string>
    {
        [ChannelCredential.BotToken] = "bot-token"
    });

    public RemoteCommandFlowIntegrationTests()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();

        _db = new VyzioDbContext(new DbContextOptionsBuilder<VyzioDbContext>()
            .UseSqlite(_connection)
            .UseSnakeCaseNamingConvention()
            .Options);
        _db.Database.EnsureCreated();

        _pairings = new ChannelPairingRepository(_db);
        _journal = new CommandJournalRepository(_db);
        _receiver = new TelegramCommandReceiver(_telegram);

        RemoteCommandRegistry? registry = null;
        _registry = registry = new RemoteCommandRegistry(
        [
            new SystemStateCommandHandler(HubOverview(), TimeZoneInfo.Utc),
            new PairConversationCommandHandler(_pairings, () => registry!),
            new HelpCommandHandler(() => registry!)
        ]);

        _sut = new HandleIncomingCommandUseCase(
            registry,
            _pairings,
            _journal,
            new ExecuteRemoteCommandUseCase(registry, _journal, NullLogger<ExecuteRemoteCommandUseCase>.Instance));
    }

    private static GetHubOverviewUseCase HubOverview()
    {
        var events = Substitute.For<IFrigateEventReader>();
        events.QueryAsync(Arg.Any<FrigateDetectionQuery>(), Arg.Any<CancellationToken>()).Returns([]);

        var cameras = Substitute.For<ICameraRepository>();
        cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);

        var profiles = Substitute.For<IProfileRepository>();
        profiles.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);

        var links = Substitute.For<IProfileCameraLinkRepository>();

        var notifications = Substitute.For<INotificationRepository>();
        notifications.CountSentAsync(Arg.Any<CancellationToken>()).Returns(0);
        notifications.GetLastSentAtAsync(Arg.Any<CancellationToken>()).Returns((DateTimeOffset?)null);

        var recordingSettings = Substitute.For<IRecordingSettingsRepository>();
        recordingSettings.GetAsync(Arg.Any<CancellationToken>()).Returns(RecordingSettings.CreateDefault());

        var channelConfigs = Substitute.For<INotificationChannelConfigRepository>();
        channelConfigs.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);

        return new GetHubOverviewUseCase(
            new GetRecentDetectionEventsUseCase(
                events,
                new DetectionEventContractProjector(
                    new CameraDirectory(cameras),
                    new DetectionProfileResolver(profiles, links),
                    recordingSettings)),
            profiles,
            notifications,
            channelConfigs,
            new NotificationChannelCatalog([]));
    }

    /// <summary>One turn of the loop: what the conversation typed goes in, what it reads comes back.</summary>
    private async Task<IReadOnlyList<string>> SayAsync(string chatId, string text)
    {
        _telegram.Incoming(chatId, text);
        _telegram.Answers.Clear();

        foreach (var incoming in await _receiver.ReceiveAsync(_registry.Descriptors, Credentials))
        {
            var result = await _sut.ExecuteAsync(incoming);
            await _receiver.RespondAsync(incoming.Origin, result, Credentials);
        }

        return _telegram.Answers;
    }

    private async Task<string> StartPairingAsync()
    {
        var catalog = new NotificationChannelCatalog([Sender()]);
        var dto = await new StartChannelPairingUseCase(catalog, _pairings, _registry)
            .ExecuteAsync(NotificationChannel.Telegram);
        return dto!.Code!;
    }

    private static INotificationChannelSender Sender()
    {
        var sender = Substitute.For<INotificationChannelSender>();
        sender.Descriptor.Returns(new NotificationChannelDescriptor(
            NotificationChannel.Telegram,
            "Telegram",
            new ChannelCapabilities(true, true, true, true, 1024),
            new ChannelTransport([new ChannelCredentialSpec(ChannelCredential.BotToken, Secret: true)]),
            new ChannelTransport([new ChannelCredentialSpec(ChannelCredential.BotToken, Secret: true)])));
        return sender;
    }

    [Fact]
    public async Task A_paired_phone_gets_the_state_of_the_home_and_a_stranger_gets_nothing()
    {
        var code = await StartPairingAsync();

        Assert.Single(await SayAsync(OwnerChat, $"/relier {code}"));

        // What the answer says is the handler's business; here, that it reaches that conversation is.
        var answered = await SayAsync(OwnerChat, "/maison");
        Assert.Contains($"chat_id={OwnerChat}", Assert.Single(answered));

        Assert.Empty(await SayAsync(StrangerChat, "/maison"));

        var entries = await _journal.GetRecentAsync(10);
        Assert.Equal(CommandOutcome.Rejected, entries[0].Outcome);
        Assert.Equal(StrangerChat, entries[0].ConversationId);
    }

    [Fact]
    public async Task A_stranger_who_guesses_wrong_stays_unheard()
    {
        await StartPairingAsync();

        Assert.Empty(await SayAsync(StrangerChat, "/relier 000000"));
        Assert.Null((await _pairings.GetByChannelAsync(NotificationChannel.Telegram))!.ConversationId);
    }

    [Fact]
    public async Task An_ordinary_message_is_answered_with_the_catalogue_once_paired_and_never_before()
    {
        var code = await StartPairingAsync();

        Assert.Empty(await SayAsync(OwnerChat, "bonjour"));

        await SayAsync(OwnerChat, $"/relier {code}");
        // The body is url-encoded on the wire; the verb is what matters, not the slash before it.
        Assert.Contains("maison", Assert.Single(await SayAsync(OwnerChat, "bonjour")));
    }

    [Fact]
    public async Task Revoking_the_pairing_puts_the_conversation_back_among_the_strangers()
    {
        var code = await StartPairingAsync();
        await SayAsync(OwnerChat, $"/relier {code}");

        await new RevokeChannelPairingUseCase(_pairings).ExecuteAsync(NotificationChannel.Telegram);

        Assert.Empty(await SayAsync(OwnerChat, "/maison"));
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    /// <summary>Telegram reduced to what the flow needs: a queue of updates, and what got sent back.</summary>
    private sealed class FakeTelegram : HttpMessageHandler, IHttpClientFactory
    {
        private readonly Queue<string> _updates = new();
        private long _updateId;

        public List<string> Answers { get; } = [];

        public void Incoming(string chatId, string text)
            => _updates.Enqueue($$$"""{"update_id":{{{++_updateId}}},"message":{"chat":{"id":{{{chatId}}}},"text":"{{{text}}}"}}""");

        public HttpClient CreateClient(string name) => new(this);

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var url = request.RequestUri!.ToString();
            var body = request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(ct);

            if (url.Contains("sendMessage", StringComparison.Ordinal)) Answers.Add(body);

            var payload = url.Contains("getUpdates", StringComparison.Ordinal)
                ? $$"""{"ok":true,"result":[{{(_updates.Count > 0 ? _updates.Dequeue() : string.Empty)}}]}"""
                : """{"ok":true}""";

            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(payload) };
        }
    }
}
