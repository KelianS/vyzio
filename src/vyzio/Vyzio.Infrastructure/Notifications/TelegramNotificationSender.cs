using System.Net;
using System.Text.Json;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Notifications;

public sealed class TelegramNotificationSender(HttpClient httpClient) : INotificationChannelSender
{
    public NotificationChannelDescriptor Descriptor { get; } = new(
        NotificationChannel.Telegram,
        "Telegram",
        // Caption limit is 1024 characters; a longer text is silently cut by Telegram.
        new ChannelCapabilities(Photo: true, Video: true, GroupedMedia: true, Buttons: true, UsefulTextLength: 1024),
        [new ChannelCredentialSpec(ChannelCredential.BotToken, Secret: true),
         new ChannelCredentialSpec(ChannelCredential.ChatId, Secret: false)]);

    public async Task SendAsync(OutgoingNotification notification, ChannelCredentials credentials, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(notification);
        ArgumentNullException.ThrowIfNull(credentials);

        var botToken = credentials[ChannelCredential.BotToken]
            ?? throw new InvalidOperationException("Telegram bot token missing.");
        var chatId = credentials[ChannelCredential.ChatId]
            ?? throw new InvalidOperationException("Telegram chat id missing.");

        var caption = Render(notification.Message);

        var response = (notification.Photo, notification.Video) switch
        {
            ({ } photo, { } video) => await SendMediaGroupAsync(photo, video, caption, botToken, chatId, ct),
            (null, { } video)      => await SendVideoAsync(video, caption, botToken, chatId, ct),
            ({ } photo, null)      => await SendPhotoAsync(photo, caption, botToken, chatId, ct),
            _                      => await SendTextAsync(caption, botToken, chatId, ct)
        };

        using (response)
            response.EnsureSuccessStatusCode();
    }

    /// <summary>Telegram renders HTML: emphasis on the headline, details on the line below.</summary>
    private static string Render(NotificationMessage message)
    {
        var text = $"<b>{WebUtility.HtmlEncode(message.Headline)}</b>";
        if (message.Details.Count > 0)
            text += $"\n{string.Join("  ·  ", message.Details.Select(WebUtility.HtmlEncode))}";
        return text;
    }

    private async Task<HttpResponseMessage> SendTextAsync(string text, string botToken, string chatId, CancellationToken ct)
    {
        using var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["chat_id"] = chatId,
            ["text"] = text,
            ["parse_mode"] = "HTML"
        });

        return await httpClient.PostAsync(Endpoint(botToken, "sendMessage"), content, ct);
    }

    private async Task<HttpResponseMessage> SendPhotoAsync(Stream photo, string caption, string botToken, string chatId, CancellationToken ct)
    {
        using var content = new MultipartFormDataContent
        {
            { new StringContent(chatId), "chat_id" },
            { new StringContent(caption), "caption" },
            { new StringContent("HTML"), "parse_mode" },
            { new StreamContent(photo), "photo", "snapshot.jpg" }
        };

        return await httpClient.PostAsync(Endpoint(botToken, "sendPhoto"), content, ct);
    }

    private async Task<HttpResponseMessage> SendVideoAsync(Stream video, string caption, string botToken, string chatId, CancellationToken ct)
    {
        using var content = new MultipartFormDataContent
        {
            { new StringContent(chatId), "chat_id" },
            { new StringContent(caption), "caption" },
            { new StringContent("HTML"), "parse_mode" },
            { new StreamContent(video), "video", "clip.mp4" }
        };

        return await httpClient.PostAsync(Endpoint(botToken, "sendVideo"), content, ct);
    }

    private async Task<HttpResponseMessage> SendMediaGroupAsync(Stream photo, Stream video, string caption, string botToken, string chatId, CancellationToken ct)
    {
        var media = JsonSerializer.Serialize(new object[]
        {
            new { type = "photo", media = "attach://photo", caption, parse_mode = "HTML" },
            new { type = "video", media = "attach://video" }
        });

        using var content = new MultipartFormDataContent
        {
            { new StringContent(chatId), "chat_id" },
            { new StringContent(media), "media" },
            { new StreamContent(photo), "photo", "snapshot.jpg" },
            { new StreamContent(video), "video", "clip.mp4" }
        };

        return await httpClient.PostAsync(Endpoint(botToken, "sendMediaGroup"), content, ct);
    }

    private static string Endpoint(string botToken, string method)
        => $"https://api.telegram.org/bot{botToken}/{method}";
}
