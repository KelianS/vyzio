using System.Net;
using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.Notifications;

/// <summary>What both directions of the Telegram channel share: its address, and how it renders text.</summary>
internal static class TelegramApi
{
    public static string Endpoint(string botToken, string method)
        => $"https://api.telegram.org/bot{botToken}/{method}";

    /// <summary>Telegram renders HTML: emphasis on the headline, details below, laid out as asked.</summary>
    public static string Html(ChannelMessage message)
    {
        var text = $"<b>{WebUtility.HtmlEncode(message.Headline)}</b>";
        if (message.Details.Count == 0) return text;

        var separator = message.Layout == ChannelMessageLayout.OnePerLine ? "\n" : "  ·  ";
        return text + $"\n{string.Join(separator, message.Details.Select(WebUtility.HtmlEncode))}";
    }
}
