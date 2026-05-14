using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Notifications;

public sealed class TelegramNotificationSender(HttpClient httpClient) : ITelegramNotificationSender
{
    public async Task SendAsync(string message, string botToken, string chatId, CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(message);
        ArgumentException.ThrowIfNullOrWhiteSpace(botToken);
        ArgumentException.ThrowIfNullOrWhiteSpace(chatId);

        using var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["chat_id"] = chatId,
            ["text"] = message
        });

        using var response = await httpClient.PostAsync(
            $"https://api.telegram.org/bot{botToken}/sendMessage",
            content,
            ct);

        response.EnsureSuccessStatusCode();
    }
}
