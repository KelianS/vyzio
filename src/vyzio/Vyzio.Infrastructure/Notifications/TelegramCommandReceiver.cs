using System.Globalization;
using System.Text;
using System.Text.Json;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Notifications;

/// <summary>
/// The Telegram bot, listening side: Vyzio holds a long poll open rather than being called, so the
/// house needs no public address (ADR-50). The same bot token as the sending side (ADR-52).
/// </summary>
public sealed class TelegramCommandReceiver(IHttpClientFactory httpClientFactory) : IChannelCommandReceiver
{
    /// <summary>Client name whose timeout outlasts a long poll; see the infrastructure registration.</summary>
    public const string HttpClientName = "telegram-commands";

    /// <summary>How long Telegram holds the request open with nothing to say; must stay under the client timeout.</summary>
    private const int LongPollSeconds = 25;

    /// <summary>Telegram cuts a command description past 256 characters.</summary>
    private const int DescriptionLimit = 256;

    // Telegram replays an update until it is acknowledged by an offset past it.
    private long _offset;

    public NotificationChannel Channel => NotificationChannel.Telegram;

    public async Task PublishCommandsAsync(
        IReadOnlyList<RemoteCommandDescriptor> commands,
        ChannelCredentials credentials,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(commands);

        var payload = JsonSerializer.Serialize(new
        {
            commands = commands.Select(command => new
            {
                command = command.Verb,
                description = command.Description.Length > DescriptionLimit
                    ? command.Description[..DescriptionLimit]
                    : command.Description
            })
        });

        using var content = new StringContent(payload, Encoding.UTF8, "application/json");
        using var response = await Client().PostAsync(
            TelegramApi.Endpoint(BotToken(credentials), "setMyCommands"), content, ct);

        response.EnsureSuccessStatusCode();
    }

    public async Task<IReadOnlyList<IncomingMessage>> ReceiveAsync(
        IReadOnlyList<RemoteCommandDescriptor> commands,
        ChannelCredentials credentials,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(commands);

        // Messages and button taps only: Vyzio has no use for the rest of what happens in the conversation.
        var url = TelegramApi.Endpoint(BotToken(credentials), "getUpdates")
                  + $"?offset={_offset}&timeout={LongPollSeconds}"
                  + "&allowed_updates=%5B%22message%22%2C%22callback_query%22%5D";

        using var response = await Client().GetAsync(url, ct);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

        if (!document.RootElement.TryGetProperty("result", out var updates)) return [];

        var received = new List<IncomingMessage>();
        foreach (var update in updates.EnumerateArray())
        {
            // Acknowledged whether it is understood or not, so an unreadable message cannot block the loop.
            if (update.TryGetProperty("update_id", out var updateId))
                _offset = updateId.GetInt64() + 1;

            if (update.TryGetProperty("callback_query", out var callback))
            {
                // Acknowledged first: an unanswered tap spins in the conversation until Telegram gives up.
                await AcknowledgeAsync(callback, credentials, ct);
                if (ParseCallback(callback, commands) is { } tapped) received.Add(tapped);
                continue;
            }

            if (Parse(update, commands) is { } incoming) received.Add(incoming);
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

        if (result.Silent) return;

        var botToken = BotToken(credentials);
        var text = TelegramApi.Html(result.Message);
        var keyboard = Keyboard(result.FollowUps, commands);

        using var response = result.Photo is { } photo
            ? await SendPhotoAsync(photo, text, keyboard, botToken, origin.ConversationId, ct)
            : await SendTextAsync(text, keyboard, botToken, origin.ConversationId, ct);

        response.EnsureSuccessStatusCode();
    }

    /// <summary>One button per proposed follow-up, stacked so a long label stays readable on a phone.</summary>
    private static string? Keyboard(
        IReadOnlyList<CommandFollowUp>? followUps,
        IReadOnlyList<RemoteCommandDescriptor> commands)
    {
        if (followUps is null || followUps.Count == 0) return null;

        var rows = followUps
            .Select(followUp => (followUp, descriptor: commands.FirstOrDefault(c => c.Name == followUp.Command)))
            .Where(pair => pair.descriptor is not null)
            .Select(pair => new[]
            {
                new
                {
                    text = pair.followUp.Label,
                    callback_data = CommandCallbackData.Write(pair.descriptor!, pair.followUp)
                }
            })
            .ToList();

        return rows.Count == 0 ? null : JsonSerializer.Serialize(new { inline_keyboard = rows });
    }

    private async Task<HttpResponseMessage> SendTextAsync(
        string text, string? keyboard, string botToken, string chatId, CancellationToken ct)
    {
        var fields = new Dictionary<string, string>
        {
            ["chat_id"] = chatId,
            ["text"] = text,
            ["parse_mode"] = "HTML"
        };
        if (keyboard is not null) fields["reply_markup"] = keyboard;

        using var content = new FormUrlEncodedContent(fields);
        return await Client().PostAsync(TelegramApi.Endpoint(botToken, "sendMessage"), content, ct);
    }

    private async Task<HttpResponseMessage> SendPhotoAsync(
        Stream photo, string caption, string? keyboard, string botToken, string chatId, CancellationToken ct)
    {
        using var content = new MultipartFormDataContent
        {
            { new StringContent(chatId), "chat_id" },
            { new StringContent(caption), "caption" },
            { new StringContent("HTML"), "parse_mode" },
            { new StreamContent(photo), "photo", "snapshot.jpg" }
        };
        if (keyboard is not null) content.Add(new StringContent(keyboard), "reply_markup");

        return await Client().PostAsync(TelegramApi.Endpoint(botToken, "sendPhoto"), content, ct);
    }

    private async Task AcknowledgeAsync(JsonElement callback, ChannelCredentials credentials, CancellationToken ct)
    {
        if (!callback.TryGetProperty("id", out var id)) return;

        using var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["callback_query_id"] = id.GetString() ?? string.Empty
        });

        using var response = await Client().PostAsync(
            TelegramApi.Endpoint(BotToken(credentials), "answerCallbackQuery"), content, ct);
    }

    /// <summary>A tap is the same thing as typing the command, plus the fact that it was proposed.</summary>
    private static IncomingMessage? ParseCallback(
        JsonElement callback,
        IReadOnlyList<RemoteCommandDescriptor> commands)
    {
        if (!callback.TryGetProperty("message", out var message)) return null;
        if (!message.TryGetProperty("chat", out var chat)) return null;
        if (!chat.TryGetProperty("id", out var chatId)) return null;

        var origin = new CommandOrigin(
            NotificationChannel.Telegram,
            chatId.GetInt64().ToString(CultureInfo.InvariantCulture));

        return CommandCallbackData.Read(
            callback.TryGetProperty("data", out var data) ? data.GetString() : null,
            origin,
            commands);
    }

    /// <summary>
    /// Matches what arrived against the declarations. What was written stays here: only the fact that
    /// this conversation said something Vyzio does not know goes further (ADR-52).
    /// </summary>
    private static IncomingMessage? Parse(JsonElement update, IReadOnlyList<RemoteCommandDescriptor> commands)
    {
        if (!update.TryGetProperty("message", out var message)) return null;
        if (!message.TryGetProperty("text", out var textElement)) return null;
        if (!message.TryGetProperty("chat", out var chat)) return null;
        if (!chat.TryGetProperty("id", out var chatId)) return null;

        var text = textElement.GetString();
        if (string.IsNullOrWhiteSpace(text)) return null;

        var origin = new CommandOrigin(
            NotificationChannel.Telegram,
            chatId.GetInt64().ToString(CultureInfo.InvariantCulture));

        if (text[0] != '/') return new IncomingMessage(origin, Command: null);

        var tokens = text.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        // In a group Telegram appends the bot name to the command: /maison@vyzio_bot
        var verb = tokens[0][1..].Split('@')[0];

        var descriptor = commands.FirstOrDefault(candidate => candidate.Answers(verb));
        if (descriptor is null) return new IncomingMessage(origin, Command: null);

        // Telegram has no typed arguments: what follows the command fills the declared parameters in order.
        var arguments = new Dictionary<string, string>();
        for (var index = 0; index < descriptor.Parameters.Count && index + 1 < tokens.Length; index++)
            arguments[descriptor.Parameters[index].Name] = tokens[index + 1];

        return new IncomingMessage(origin, descriptor.Name, arguments);
    }

    private HttpClient Client() => httpClientFactory.CreateClient(HttpClientName);

    private static string BotToken(ChannelCredentials credentials)
    {
        ArgumentNullException.ThrowIfNull(credentials);
        return credentials[ChannelCredential.BotToken]
               ?? throw new InvalidOperationException("Telegram bot token missing.");
    }
}
