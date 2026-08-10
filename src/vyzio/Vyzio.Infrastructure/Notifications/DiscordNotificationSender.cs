using System.Text;
using System.Text.Json;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Notifications;

/// <summary>
/// Talks to a Discord room through the bot that also listens there: one identity for both directions
/// (ADR-52), attachments in the same message as the text.
/// </summary>
public sealed class DiscordNotificationSender(HttpClient httpClient) : INotificationChannelSender
{
    private static readonly ChannelTransport Transport = new(
    [
        new ChannelCredentialSpec(ChannelCredential.BotToken, Secret: true),
        new ChannelCredentialSpec(ChannelCredential.ChatId, Secret: false)
    ]);

    public NotificationChannelDescriptor Descriptor { get; } = new(
        NotificationChannel.Discord,
        "Discord",
        // A bot message carries 2000 characters, several files, and interactive components.
        new ChannelCapabilities(Photo: true, Video: true, GroupedMedia: true, Buttons: true, UsefulTextLength: 2000),
        // The same bot reads and writes, so the same credentials answer for both directions.
        Transport,
        Transport);

    public async Task SendAsync(OutgoingNotification notification, ChannelCredentials credentials, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(notification);

        var payload = JsonSerializer.Serialize(new { content = DiscordApi.Render(notification.Message) });

        using var content = new MultipartFormDataContent
        {
            { new StringContent(payload, Encoding.UTF8, "application/json"), "payload_json" }
        };

        // Discord numbers its attachments: the order below is the order they appear in the message.
        var index = 0;
        if (notification.Photo is { } photo)
            content.Add(new StreamContent(photo), $"files[{index++}]", "snapshot.jpg");
        if (notification.Video is { } video)
            content.Add(new StreamContent(video), $"files[{index}]", "clip.mp4");

        using var request = DiscordApi.Request(
            HttpMethod.Post,
            $"/channels/{DiscordApi.Room(credentials)}/messages",
            DiscordApi.BotToken(credentials));
        request.Content = content;

        using var response = await httpClient.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
    }
}
