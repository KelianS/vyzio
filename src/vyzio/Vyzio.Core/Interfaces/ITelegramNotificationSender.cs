namespace Vyzio.Core.Interfaces;

public interface ITelegramNotificationSender
{
    Task SendAsync(string message, string botToken, string chatId, CancellationToken ct = default);
}