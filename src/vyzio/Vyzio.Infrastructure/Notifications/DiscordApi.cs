using System.Net.Http.Headers;
using System.Text;
using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.Notifications;

/// <summary>What the two directions of the Discord bot share: its address, its credentials, its markup.</summary>
internal static class DiscordApi
{
    /// <summary>Client name whose timeout outlasts nothing in particular; the gateway is not HTTP.</summary>
    public const string HttpClientName = "discord";

    private const string BaseUrl = "https://discord.com/api/v10";

    public static HttpRequestMessage Request(HttpMethod method, string path, string botToken)
    {
        var request = new HttpRequestMessage(method, BaseUrl + path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bot", botToken);
        return request;
    }

    public static string BotToken(ChannelCredentials credentials)
    {
        ArgumentNullException.ThrowIfNull(credentials);
        return credentials[ChannelCredential.BotToken]
               ?? throw new InvalidOperationException("Discord bot token missing.");
    }

    public static string Room(ChannelCredentials credentials)
    {
        ArgumentNullException.ThrowIfNull(credentials);
        return credentials[ChannelCredential.ChatId]
               ?? throw new InvalidOperationException("Discord room missing.");
    }

    /// <summary>Discord renders Markdown: bold headline, details below, laid out as asked.</summary>
    public static string Render(ChannelMessage message)
    {
        ArgumentNullException.ThrowIfNull(message);

        var text = $"**{Escape(message.Headline)}**";
        if (message.Details.Count == 0) return text;

        var separator = message.Layout == ChannelMessageLayout.OnePerLine ? "\n" : "  ·  ";
        return text + $"\n{string.Join(separator, message.Details.Select(Escape))}";
    }

    // A camera named "salon_*_2" would otherwise turn half the message into italics.
    private static string Escape(string value)
    {
        var escaped = new StringBuilder(value.Length);
        foreach (var character in value)
        {
            if (character is '*' or '_' or '~' or '`' or '>' or '|' or '\\')
                escaped.Append('\\');
            escaped.Append(character);
        }
        return escaped.ToString();
    }
}
