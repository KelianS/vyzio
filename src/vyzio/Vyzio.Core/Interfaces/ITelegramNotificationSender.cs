namespace Vyzio.Core.Interfaces;

public interface ITelegramNotificationSender
{
    Task SendAsync(string message, CancellationToken ct = default);
}