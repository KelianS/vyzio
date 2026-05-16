namespace Vyzio.Core.Interfaces;

public interface ITelegramNotificationSender
{
    Task SendAsync(string message, string botToken, string chatId, CancellationToken ct = default);
    Task SendPhotoAsync(Stream photo, string caption, string botToken, string chatId, CancellationToken ct = default);
    Task SendVideoAsync(Stream video, Stream? thumbnail, string caption, string botToken, string chatId, CancellationToken ct = default);
}