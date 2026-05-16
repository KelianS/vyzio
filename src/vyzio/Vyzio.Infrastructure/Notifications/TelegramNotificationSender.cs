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
            ["text"] = message,
            ["parse_mode"] = "HTML"
        });

        using var response = await httpClient.PostAsync(
            $"https://api.telegram.org/bot{botToken}/sendMessage",
            content,
            ct);

        response.EnsureSuccessStatusCode();
    }

    public async Task SendPhotoAsync(Stream photo, string caption, string botToken, string chatId, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(photo);
        ArgumentException.ThrowIfNullOrWhiteSpace(botToken);
        ArgumentException.ThrowIfNullOrWhiteSpace(chatId);

        using var content = new MultipartFormDataContent();
        content.Add(new StringContent(chatId), "chat_id");
        content.Add(new StringContent(caption), "caption");
        content.Add(new StringContent("HTML"), "parse_mode");
        content.Add(new StreamContent(photo), "photo", "snapshot.jpg");

        using var response = await httpClient.PostAsync(
            $"https://api.telegram.org/bot{botToken}/sendPhoto",
            content,
            ct);

        response.EnsureSuccessStatusCode();
    }

    public async Task SendVideoAsync(Stream video, Stream? thumbnail, string caption, string botToken, string chatId, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(video);
        ArgumentException.ThrowIfNullOrWhiteSpace(botToken);
        ArgumentException.ThrowIfNullOrWhiteSpace(chatId);

        using var content = new MultipartFormDataContent();
        content.Add(new StringContent(chatId), "chat_id");
        content.Add(new StringContent(caption), "caption");
        content.Add(new StringContent("HTML"), "parse_mode");
        content.Add(new StreamContent(video), "video", "clip.mp4");
        if (thumbnail is not null)
            content.Add(new StreamContent(thumbnail), "thumbnail", "thumbnail.jpg");

        using var response = await httpClient.PostAsync(
            $"https://api.telegram.org/bot{botToken}/sendVideo",
            content,
            ct);

        response.EnsureSuccessStatusCode();
    }

    public async Task SendMediaGroupAsync(Stream photo, Stream video, string caption, string botToken, string chatId, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(photo);
        ArgumentNullException.ThrowIfNull(video);
        ArgumentException.ThrowIfNullOrWhiteSpace(botToken);
        ArgumentException.ThrowIfNullOrWhiteSpace(chatId);

        var media = System.Text.Json.JsonSerializer.Serialize(new object[]
        {
            new { type = "photo", media = "attach://photo", caption, parse_mode = "HTML" },
            new { type = "video", media = "attach://video" }
        });

        using var content = new MultipartFormDataContent();
        content.Add(new StringContent(chatId), "chat_id");
        content.Add(new StringContent(media), "media");
        content.Add(new StreamContent(photo), "photo", "snapshot.jpg");
        content.Add(new StreamContent(video), "video", "clip.mp4");

        using var response = await httpClient.PostAsync(
            $"https://api.telegram.org/bot{botToken}/sendMediaGroup",
            content,
            ct);

        response.EnsureSuccessStatusCode();
    }
}
