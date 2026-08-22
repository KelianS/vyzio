using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Notifications;

namespace Vyzio.Tests.Services;

public class DiscordCommandReceiverTests
{
    private const string Room = "4242";

    private static readonly ChannelCredentials Credentials = new(new Dictionary<ChannelCredential, string>
    {
        [ChannelCredential.BotToken] = "bot-token",
        [ChannelCredential.ChatId] = Room
    });

    private static readonly IReadOnlyList<RemoteCommandDescriptor> Commands =
    [
        RemoteCommandDescriptor.Consultation(RemoteCommandName.SystemState, "maison", "Ce qui se passe chez vous"),
        new RemoteCommandDescriptor(RemoteCommandName.Pair, "relier", "Relier cette conversation",
            CommandAuthorization.Pairing,
            [new RemoteCommandParameter("code", CommandParameterKind.Text, Required: true, "Le code")])
    ];

    private const string SlashCommand =
        """{"id":"i1","token":"tok-1","type":2,"channel_id":"4242","data":{"name":"relier","options":[{"name":"code","value":"123456","type":3}]}}""";

    private const string SecondSlashCommand =
        """{"id":"i3","token":"tok-3","type":2,"channel_id":"4242","data":{"name":"maison"}}""";

    private const string ButtonTap =
        """{"id":"i2","token":"tok-2","type":3,"channel_id":"4242","data":{"custom_id":"relier|1|123456"}}""";

    private static DiscordCommandReceiver CreateSut(RecordingHandler handler, params string[] interactions)
        => new(handler, new FakeGateway(interactions), NullLogger<DiscordCommandReceiver>.Instance);

    [Fact]
    public async Task Publishes_the_commands_as_application_commands_with_their_typed_parameters()
    {
        var handler = new RecordingHandler();

        await CreateSut(handler).PublishCommandsAsync(Commands, Credentials);

        // The application is deduced from the bot: one field fewer to ask the user for.
        Assert.Contains("/oauth2/applications/@me", handler.Requests[0]);
        Assert.Contains("/applications/app-1/commands", handler.Requests[1]);
        Assert.Contains("\"name\":\"maison\"", handler.Bodies[1]);
        Assert.Contains("\"name\":\"code\"", handler.Bodies[1]);
        Assert.Contains("\"required\":true", handler.Bodies[1]);
    }

    [Fact]
    public async Task Reads_a_command_its_argument_and_the_room_it_came_from()
    {
        var handler = new RecordingHandler();

        var received = await CreateSut(handler, SlashCommand).ReceiveAsync(Commands, Credentials);

        var incoming = Assert.Single(received);
        Assert.Equal(RemoteCommandName.Pair, incoming.Command);
        Assert.Equal(NotificationChannel.Discord, incoming.Origin.Channel);
        Assert.Equal(Room, incoming.Origin.ConversationId);
        Assert.Equal("123456", incoming.Arguments!["code"]);

        // Past three seconds without an acknowledgement, Discord tells the user Vyzio is broken.
        Assert.Contains("/interactions/i1/tok-1/callback", handler.Requests[0]);
    }

    [Fact]
    public async Task Reads_a_button_tap_as_the_command_it_carried_and_as_a_confirmation()
    {
        var handler = new RecordingHandler();

        var received = await CreateSut(handler, ButtonTap).ReceiveAsync(Commands, Credentials);

        var incoming = Assert.Single(received);
        Assert.Equal(RemoteCommandName.Pair, incoming.Command);
        Assert.Equal("123456", incoming.Arguments!["code"]);
        Assert.True(incoming.Confirmed);
    }

    [Fact]
    public async Task Answers_where_the_command_was_typed_and_turns_a_follow_up_into_a_button()
    {
        var handler = new RecordingHandler();
        var sut = CreateSut(handler, SlashCommand);

        var incoming = Assert.Single(await sut.ReceiveAsync(Commands, Credentials));
        await sut.RespondAsync(
            incoming.Origin,
            new CommandResult(
                ChannelMessage.Plain("Relier cette conversation ?"),
                FollowUps:
                [
                    new CommandFollowUp("Oui", RemoteCommandName.Pair,
                        new Dictionary<string, string> { ["code"] = "123456" }, Confirms: true)
                ]),
            Commands,
            Credentials);

        // The acknowledgement already shown is filled in, rather than a second message appearing below it.
        Assert.Contains(handler.Requests, request => request.Contains("/webhooks/app-1/tok-1/messages/@original"));
        Assert.Contains("relier|1|123456", handler.Bodies[^1]);
    }

    [Fact]
    public async Task Leaves_nothing_at_all_behind_when_the_answer_is_silence()
    {
        var handler = new RecordingHandler();
        var sut = CreateSut(handler, SlashCommand);

        var incoming = Assert.Single(await sut.ReceiveAsync(Commands, Credentials));
        await sut.RespondAsync(incoming.Origin, CommandResult.Silence, Commands, Credentials);

        Assert.Equal(HttpMethod.Delete, handler.Methods[^1]);
        Assert.DoesNotContain(handler.Requests, request => request.Contains("/webhooks/app-1/tok-1", StringComparison.Ordinal)
                                                           && !request.EndsWith("@original", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Answers_each_interaction_of_a_room_on_its_own_thread_when_two_arrive_at_once()
    {
        var handler = new RecordingHandler();
        var sut = CreateSut(handler, SlashCommand, SecondSlashCommand);

        var received = await sut.ReceiveAsync(Commands, Credentials);
        Assert.Equal(2, received.Count);

        foreach (var incoming in received)
            await sut.RespondAsync(incoming.Origin, new CommandResult(ChannelMessage.Plain("Voila")), Commands, Credentials);

        // Both were acknowledged in the same room: answering the second on the first's token would
        // leave a "Vyzio reflechit" hanging forever and lose an answer.
        Assert.Contains(handler.Requests, request => request.Contains("/webhooks/app-1/tok-1/messages/@original"));
        Assert.Contains(handler.Requests, request => request.Contains("/webhooks/app-1/tok-3/messages/@original"));
    }

    /// <summary>The gateway reduced to a script: what Discord says, said once, then silence.</summary>
    private sealed class FakeGateway(params string[] interactions) : IDiscordGatewaySocketFactory
    {
        public IDiscordGatewaySocket Create() => new Socket(interactions);

        private sealed class Socket(string[] interactions) : IDiscordGatewaySocket
        {
            private readonly Queue<string> _frames = new(
            [
                """{"op":10,"d":{"heartbeat_interval":45000}}""",
                .. interactions.Select(interaction => $$"""{"op":0,"s":1,"t":"INTERACTION_CREATE","d":{{interaction}}}""")
            ]);

            public Task ConnectAsync(Uri uri, CancellationToken ct) => Task.CompletedTask;

            public Task SendAsync(string payload, CancellationToken ct) => Task.CompletedTask;

            public async Task<string?> ReceiveAsync(CancellationToken ct)
            {
                if (_frames.Count > 0) return _frames.Dequeue();

                await Task.Delay(Timeout.Infinite, ct);
                return null;
            }

            public void Dispose()
            {
            }
        }
    }

    private sealed class RecordingHandler : HttpMessageHandler, IHttpClientFactory
    {
        public List<string> Requests { get; } = [];

        public List<HttpMethod> Methods { get; } = [];

        public List<string> Bodies { get; } = [];

        public HttpClient CreateClient(string name) => new(this);

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Requests.Add(request.RequestUri!.ToString());
            Methods.Add(request.Method);
            Bodies.Add(request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(ct));

            var body = request.RequestUri!.ToString().Contains("applications/@me", StringComparison.Ordinal)
                ? """{"id":"app-1"}"""
                : "{}";

            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body) };
        }
    }
}
