using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Notifications;

/// <summary>
/// The Discord bot, listening side. Commands are published as application commands, so the user picks
/// them from Discord's own autocompletion and Vyzio never has to watch the room (ADR-52).
/// </summary>
public sealed class DiscordCommandReceiver : IChannelCommandReceiver
{
    /// <summary>Discord cuts a command or option description past 100 characters.</summary>
    private const int DescriptionLimit = 100;

    /// <summary>How long a turn of the loop waits for something to happen before coming back empty-handed.</summary>
    private static readonly TimeSpan PollWindow = TimeSpan.FromSeconds(25);

    private const int CommandInteraction = 2;
    private const int ComponentInteraction = 3;

    /// <summary>Discord shows an error unless an interaction is acknowledged within three seconds.</summary>
    private const int AcknowledgeAndAnswerLater = 5;
    private const int AcknowledgeSilently = 6;

    private const int TextOption = 3;
    private const int NumberOption = 4;

    /// <summary>Discord stacks at most five buttons per row.</summary>
    private const int ButtonsPerRow = 5;

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IDiscordGatewaySocketFactory _sockets;
    private readonly ILogger<DiscordCommandReceiver> _logger;

    /// <summary>The interactions a conversation is waiting on, oldest first: the only route back Discord offers.</summary>
    private readonly Dictionary<string, Queue<PendingAnswer>> _pending = [];

    private DiscordGateway? _gateway;
    private Task? _connection;
    private string? _applicationId;

    public DiscordCommandReceiver(IHttpClientFactory httpClientFactory, ILogger<DiscordCommandReceiver> logger)
        : this(httpClientFactory, new ClientWebSocketFactory(), logger)
    {
    }

    internal DiscordCommandReceiver(
        IHttpClientFactory httpClientFactory,
        IDiscordGatewaySocketFactory sockets,
        ILogger<DiscordCommandReceiver> logger)
    {
        _httpClientFactory = httpClientFactory;
        _sockets = sockets;
        _logger = logger;
    }

    public NotificationChannel Channel => NotificationChannel.Discord;

    /// <summary>An interaction already acknowledged, and whether the acknowledgement is visible.</summary>
    private sealed record PendingAnswer(string Token, bool ShowsThinking);

    public async Task PublishCommandsAsync(
        IReadOnlyList<RemoteCommandDescriptor> commands,
        ChannelCredentials credentials,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(commands);

        var botToken = DiscordApi.BotToken(credentials);
        var payload = JsonSerializer.Serialize(commands.Select(command => new
        {
            name = command.Verb,
            description = Shorten(command.Description),
            options = Options(command)
        }));

        using var request = DiscordApi.Request(
            HttpMethod.Put, $"/applications/{await ApplicationIdAsync(botToken, ct)}/commands", botToken);
        request.Content = new StringContent(payload, Encoding.UTF8, "application/json");

        using var response = await Client().SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
    }

    /// <summary>Discord validates a typed parameter before it travels, and refuses a required one after an optional one.</summary>
    private static object[] Options(RemoteCommandDescriptor command) => [.. command.Parameters
        .OrderByDescending(parameter => parameter.Required)
        .Select(parameter => new
        {
            type = parameter.Kind == CommandParameterKind.Number ? NumberOption : TextOption,
            name = parameter.Name,
            description = Shorten(parameter.Description),
            required = parameter.Required
        })];

    public async Task<IReadOnlyList<IncomingMessage>> ReceiveAsync(
        IReadOnlyList<RemoteCommandDescriptor> commands,
        ChannelCredentials credentials,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(commands);

        var botToken = DiscordApi.BotToken(credentials);
        var gateway = Connect(botToken, ct);

        using var window = CancellationTokenSource.CreateLinkedTokenSource(ct);
        window.CancelAfter(PollWindow);

        try
        {
            if (!await gateway.Interactions.WaitToReadAsync(window.Token)) return [];
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            // Nothing was said during the window; the loop simply comes back.
            return [];
        }

        var received = new List<IncomingMessage>();
        while (gateway.Interactions.TryRead(out var interaction))
        {
            if (await AcknowledgeAsync(interaction, commands, botToken, ct) is { } incoming)
                received.Add(incoming);
        }

        return received;
    }

    public async Task RespondAsync(
        CommandOrigin origin,
        CommandResult result,
        IReadOnlyList<RemoteCommandDescriptor> commands,
        ChannelCredentials credentials,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(origin);
        ArgumentNullException.ThrowIfNull(result);
        ArgumentNullException.ThrowIfNull(commands);

        // Answered in the order received: two interactions may well be open in the same room at once.
        if (!_pending.TryGetValue(origin.ConversationId, out var waiting) || !waiting.TryDequeue(out var pending))
        {
            // Discord offers no other route back: an interaction lost to a restart cannot be answered.
            _logger.LogWarning("No Discord interaction left to answer in conversation {Conversation}.", origin.ConversationId);
            return;
        }

        if (waiting.Count == 0) _pending.Remove(origin.ConversationId);

        var botToken = DiscordApi.BotToken(credentials);
        var applicationId = await ApplicationIdAsync(botToken, ct);
        var original = $"/webhooks/{applicationId}/{pending.Token}/messages/@original";

        if (result.Silent)
        {
            // Silence has to leave nothing behind — not even a message saying Vyzio is thinking.
            if (!pending.ShowsThinking) return;

            using var deletion = DiscordApi.Request(HttpMethod.Delete, original, botToken);
            using var deleted = await Client().SendAsync(deletion, ct);
            deleted.EnsureSuccessStatusCode();
            return;
        }

        // A visible acknowledgement is a placeholder to fill in; a silent one leaves room for a new message.
        using var request = pending.ShowsThinking
            ? DiscordApi.Request(HttpMethod.Patch, original, botToken)
            : DiscordApi.Request(HttpMethod.Post, $"/webhooks/{applicationId}/{pending.Token}", botToken);

        request.Content = Body(result, commands);

        using var response = await Client().SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
    }

    private static HttpContent Body(CommandResult result, IReadOnlyList<RemoteCommandDescriptor> commands)
    {
        var payload = JsonSerializer.Serialize(new
        {
            content = DiscordApi.Render(result.Message),
            components = Buttons(result.FollowUps, commands)
        });

        if (result.Photo is not { } photo)
            return new StringContent(payload, Encoding.UTF8, "application/json");

        return new MultipartFormDataContent
        {
            { new StringContent(payload, Encoding.UTF8, "application/json"), "payload_json" },
            { new StreamContent(photo), "files[0]", "snapshot.jpg" }
        };
    }

    /// <summary>One button per proposed follow-up, carrying the very command it proposes.</summary>
    private static object[] Buttons(
        IReadOnlyList<CommandFollowUp>? followUps,
        IReadOnlyList<RemoteCommandDescriptor> commands)
    {
        if (followUps is null || followUps.Count == 0) return [];

        var buttons = followUps
            .Select(followUp => (followUp, descriptor: commands.FirstOrDefault(c => c.Name == followUp.Command)))
            .Where(pair => pair.descriptor is not null)
            .Select(pair => new
            {
                type = 2,
                style = pair.followUp.Confirms ? 3 : 2,
                label = pair.followUp.Label,
                custom_id = CommandCallbackData.Write(pair.descriptor!, pair.followUp)
            })
            .ToList();

        return [.. buttons
            .Chunk(ButtonsPerRow)
            .Select(row => new { type = 1, components = row })];
    }

    /// <summary>
    /// Tells Discord the interaction was heard, then reads it. Acknowledging first is not politeness:
    /// past three seconds Discord tells the user the application is broken.
    /// </summary>
    private async Task<IncomingMessage?> AcknowledgeAsync(
        JsonElement interaction,
        IReadOnlyList<RemoteCommandDescriptor> commands,
        string botToken,
        CancellationToken ct)
    {
        if (!interaction.TryGetProperty("channel_id", out var room)) return null;
        if (!interaction.TryGetProperty("id", out var id)) return null;
        if (!interaction.TryGetProperty("token", out var token)) return null;

        var type = interaction.TryGetProperty("type", out var kind) ? kind.GetInt32() : 0;
        if (type is not (CommandInteraction or ComponentInteraction)) return null;

        var showsThinking = type == CommandInteraction;
        var acknowledgement = showsThinking ? AcknowledgeAndAnswerLater : AcknowledgeSilently;

        using var request = DiscordApi.Request(
            HttpMethod.Post, $"/interactions/{id.GetString()}/{token.GetString()}/callback", botToken);
        request.Content = new StringContent(
            JsonSerializer.Serialize(new { type = acknowledgement }), Encoding.UTF8, "application/json");

        using var response = await Client().SendAsync(request, ct);
        response.EnsureSuccessStatusCode();

        var conversation = room.GetString()!;
        if (!_pending.TryGetValue(conversation, out var waiting))
            _pending[conversation] = waiting = new Queue<PendingAnswer>();
        waiting.Enqueue(new PendingAnswer(token.GetString()!, showsThinking));

        var origin = new CommandOrigin(NotificationChannel.Discord, conversation);
        return Parse(interaction, origin, commands, type);
    }

    private static IncomingMessage? Parse(
        JsonElement interaction,
        CommandOrigin origin,
        IReadOnlyList<RemoteCommandDescriptor> commands,
        int type)
    {
        if (!interaction.TryGetProperty("data", out var data)) return null;

        if (type == ComponentInteraction)
        {
            return CommandCallbackData.Read(
                data.TryGetProperty("custom_id", out var customId) ? customId.GetString() : null,
                origin,
                commands);
        }

        var verb = data.TryGetProperty("name", out var name) ? name.GetString() : null;
        var descriptor = commands.FirstOrDefault(candidate => candidate.Answers(verb ?? string.Empty));
        if (descriptor is null) return new IncomingMessage(origin, Command: null);

        // Discord names and types every argument itself: what arrives is already validated.
        var arguments = new Dictionary<string, string>();
        if (data.TryGetProperty("options", out var options))
        {
            foreach (var option in options.EnumerateArray())
            {
                if (!option.TryGetProperty("name", out var key)) continue;
                if (!option.TryGetProperty("value", out var value)) continue;
                arguments[key.GetString()!] = value.ToString();
            }
        }

        return new IncomingMessage(origin, descriptor.Name, arguments);
    }

    /// <summary>The connection outlives a turn of the loop; a dropped one is dialled again on the next.</summary>
    private DiscordGateway Connect(string botToken, CancellationToken ct)
    {
        if (_gateway is not null && _connection is { IsCompleted: false }) return _gateway;

        _gateway = new DiscordGateway(_sockets, _logger);
        _connection = _gateway.RunAsync(botToken, ct);
        return _gateway;
    }

    /// <summary>The bot knows which application it belongs to; asking spares the user one more field.</summary>
    private async Task<string> ApplicationIdAsync(string botToken, CancellationToken ct)
    {
        if (_applicationId is not null) return _applicationId;

        using var request = DiscordApi.Request(HttpMethod.Get, "/oauth2/applications/@me", botToken);
        using var response = await Client().SendAsync(request, ct);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

        return _applicationId = document.RootElement.GetProperty("id").GetString()!;
    }

    private static string Shorten(string description) =>
        description.Length > DescriptionLimit ? description[..DescriptionLimit] : description;

    private HttpClient Client() => _httpClientFactory.CreateClient(DiscordApi.HttpClientName);
}
