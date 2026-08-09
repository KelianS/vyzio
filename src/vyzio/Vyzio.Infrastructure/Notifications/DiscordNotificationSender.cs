using System.Text;
using System.Text.Json;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Notifications;

/// <summary>
/// Talks to a Discord incoming webhook: one address, no bot to keep online, and attachments in the
/// same message as the text.
/// </summary>
public sealed class DiscordNotificationSender(HttpClient httpClient) : INotificationChannelSender
{
    public NotificationChannelDescriptor Descriptor { get; } = new(
        NotificationChannel.Discord,
        "Discord",
        // A webhook message carries 2000 characters and several files, but no interactive component.
        new ChannelCapabilities(Photo: true, Video: true, GroupedMedia: true, Buttons: false, UsefulTextLength: 2000),
        [new ChannelCredentialSpec(ChannelCredential.WebhookUrl, Secret: true)]);

    public async Task SendAsync(OutgoingNotification notification, ChannelCredentials credentials, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(notification);
        ArgumentNullException.ThrowIfNull(credentials);

        var webhookUrl = credentials[ChannelCredential.WebhookUrl]
            ?? throw new InvalidOperationException("Discord webhook URL missing.");

        var payload = JsonSerializer.Serialize(new { content = Render(notification.Message) });

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

        using var response = await httpClient.PostAsync(webhookUrl, content, ct);
        response.EnsureSuccessStatusCode();
    }

    /// <summary>Discord renders Markdown: bold headline, details on the line below.</summary>
    private static string Render(NotificationMessage message)
    {
        var text = $"**{Escape(message.Headline)}**";
        if (message.Details.Count > 0)
            text += $"\n{string.Join("  ·  ", message.Details.Select(Escape))}";
        return text;
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
