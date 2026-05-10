using System.Net.Http;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Configuration;

namespace Vyzio.Infrastructure.Notifications;

public sealed class TelegramNotificationSender(
    HttpClient httpClient,
    VyzioRuntimeSettings settings) : ITelegramNotificationSender
{
    public async Task SendAsync(string message, CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(message);

        var telegram = settings.Notifications.Telegram;
        if (!telegram.IsEnabled)
        {
            throw new InvalidOperationException("Telegram notifications are not configured.");
        }

        using var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["chat_id"] = telegram.ChatId,
            ["text"] = message
        });

        using var response = await httpClient.PostAsync(
            $"https://api.telegram.org/bot{telegram.BotToken}/sendMessage",
            content,
            ct);

        response.EnsureSuccessStatusCode();
    }
}