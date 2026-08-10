using System.Net;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Notifications;

namespace Vyzio.Tests.Services;

public class TelegramCommandReceiverTests
{
    private static readonly ChannelCredentials Credentials = new(new Dictionary<ChannelCredential, string>
    {
        [ChannelCredential.BotToken] = "bot-token"
    });

    private static readonly IReadOnlyList<RemoteCommandDescriptor> Commands =
    [
        RemoteCommandDescriptor.Consultation(RemoteCommandName.SystemState, "maison", "Ce qui se passe chez vous"),
        new RemoteCommandDescriptor(RemoteCommandName.Pair, "relier", "Relier cette conversation",
            CommandAuthorization.Pairing,
            [new RemoteCommandParameter("code", CommandParameterKind.Text, Required: true, "Le code")])
    ];

    private static string Updates(params string[] messages)
        => $$"""{"ok":true,"result":[{{string.Join(',', messages)}}]}""";

    private static string Message(long updateId, long chatId, string text)
        => $$$"""{"update_id":{{{updateId}}},"message":{"chat":{"id":{{{chatId}}}},"text":"{{{text}}}"}}""";

    [Fact]
    public async Task Reads_a_command_its_argument_and_the_conversation_it_came_from()
    {
        var handler = new RecordingHandler(Updates(Message(1, 4242, "/relier 123456")));

        var received = await new TelegramCommandReceiver(handler.AsFactory())
            .ReceiveAsync(Commands, Credentials);

        var incoming = Assert.Single(received);
        Assert.Equal(RemoteCommandName.Pair, incoming.Command);
        Assert.Equal(NotificationChannel.Telegram, incoming.Origin.Channel);
        Assert.Equal("4242", incoming.Origin.ConversationId);
        Assert.Equal("123456", incoming.Arguments!["code"]);
    }

    [Fact]
    public async Task Reads_a_command_addressed_to_the_bot_by_name_in_a_group()
    {
        var handler = new RecordingHandler(Updates(Message(1, 7, "/maison@vyzio_bot")));

        var received = await new TelegramCommandReceiver(handler.AsFactory())
            .ReceiveAsync(Commands, Credentials);

        Assert.Equal(RemoteCommandName.SystemState, Assert.Single(received).Command);
    }

    [Fact]
    public async Task Reports_ordinary_conversation_and_undeclared_commands_as_understood_by_nobody()
    {
        var handler = new RecordingHandler(Updates(
            Message(1, 7, "bonjour"),
            Message(2, 7, "/open_the_gate")));

        var received = await new TelegramCommandReceiver(handler.AsFactory())
            .ReceiveAsync(Commands, Credentials);

        // The wording stays in the adapter; only "this conversation said something unknown" travels.
        Assert.Equal(2, received.Count);
        Assert.All(received, message => Assert.Null(message.Command));
    }

    [Fact]
    public async Task Acknowledges_what_it_read_so_the_next_poll_moves_on()
    {
        var handler = new RecordingHandler(
            Updates(Message(11, 7, "bonjour")),
            Updates());
        var receiver = new TelegramCommandReceiver(handler.AsFactory());

        await receiver.ReceiveAsync(Commands, Credentials);
        await receiver.ReceiveAsync(Commands, Credentials);

        Assert.Contains("offset=0", handler.Requests[0]);
        Assert.Contains("offset=12", handler.Requests[1]);
    }

    [Fact]
    public async Task Publishes_the_commands_in_the_grammar_of_the_channel()
    {
        var handler = new RecordingHandler("""{"ok":true}""");

        await new TelegramCommandReceiver(handler.AsFactory()).PublishCommandsAsync(Commands, Credentials);

        Assert.Contains("setMyCommands", handler.Requests[0]);
        Assert.Contains("\"command\":\"maison\"", handler.Bodies[0]);
        Assert.Contains("\"command\":\"relier\"", handler.Bodies[0]);
    }

    [Fact]
    public async Task Sends_nothing_at_all_when_the_answer_is_silence()
    {
        var handler = new RecordingHandler();

        await new TelegramCommandReceiver(handler.AsFactory()).RespondAsync(
            new CommandOrigin(NotificationChannel.Telegram, "7"), CommandResult.Silence, Commands, Credentials);

        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task Answers_in_the_conversation_that_asked()
    {
        var handler = new RecordingHandler("""{"ok":true}""");

        await new TelegramCommandReceiver(handler.AsFactory()).RespondAsync(
            new CommandOrigin(NotificationChannel.Telegram, "4242"),
            CommandResult.Text("Tout va bien chez vous", ["Aucune detection recente"]),
            Commands,
            Credentials);

        Assert.Contains("sendMessage", handler.Requests[0]);
        Assert.Contains("chat_id=4242", handler.Bodies[0]);
    }

    [Fact]
    public async Task Turns_a_proposed_follow_up_into_a_button_that_carries_the_command()
    {
        var handler = new RecordingHandler("""{"ok":true}""");

        await new TelegramCommandReceiver(handler.AsFactory()).RespondAsync(
            new CommandOrigin(NotificationChannel.Telegram, "7"),
            new CommandResult(
                ChannelMessage.Plain("Relier cette conversation ?"),
                FollowUps:
                [
                    new CommandFollowUp("Oui", RemoteCommandName.Pair,
                        new Dictionary<string, string> { ["code"] = "123456" }, Confirms: true)
                ]),
            Commands,
            Credentials);

        Assert.Contains("reply_markup", handler.Bodies[0]);
        Assert.Contains("relier%7C1%7C123456", handler.Bodies[0]);
    }

    [Fact]
    public async Task Reads_a_button_tap_as_the_command_it_carried_and_as_a_confirmation()
    {
        var handler = new RecordingHandler(
            """{"ok":true,"result":[{"update_id":3,"callback_query":{"id":"c1","data":"relier|1|123456","message":{"chat":{"id":4242}}}}]}""");

        var received = await new TelegramCommandReceiver(handler.AsFactory())
            .ReceiveAsync(Commands, Credentials);

        var incoming = Assert.Single(received);
        Assert.Equal(RemoteCommandName.Pair, incoming.Command);
        Assert.Equal("123456", incoming.Arguments!["code"]);
        Assert.True(incoming.Confirmed);
        Assert.Equal("4242", incoming.Origin.ConversationId);

        // Left unanswered, the tap keeps spinning in the conversation.
        Assert.Contains(handler.Requests, request => request.Contains("answerCallbackQuery"));
    }

    private sealed class RecordingHandler(params string[] responses) : HttpMessageHandler
    {
        private int _call;

        public List<string> Requests { get; } = [];

        public List<string> Bodies { get; } = [];

        public HttpClient AsClient() => new(this);

        public IHttpClientFactory AsFactory() => new Factory(this);

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Requests.Add(request.RequestUri!.ToString());
            Bodies.Add(request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(ct));

            var body = _call < responses.Length ? responses[_call++] : """{"ok":true}""";
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body) };
        }

        private sealed class Factory(RecordingHandler handler) : IHttpClientFactory
        {
            public HttpClient CreateClient(string name) => handler.AsClient();
        }
    }
}
