using System.Text.Json;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Notifications;

public interface IDetectionNotificationDispatcher
{
    Task<bool> ExecuteAsync(FrigateDetection detection, CancellationToken ct = default);
}

/// <summary>
/// Sends one detection on every configured channel. Nothing here knows which channels exist: the
/// message is composed once, the channel renders it with what it declares it can do (ADR-50).
/// </summary>
public sealed class SendDetectionNotificationUseCase(
    INotificationRepository notifications,
    INotificationChannelCatalog catalog,
    INotificationChannelConfigRepository channelConfigs,
    IFrigateEventImageProvider imageProvider,
    IFrigateClipProvider clipProvider,
    DetectionMessageFormatter formatter,
    TimeZoneInfo timeZone,
    ILogger<SendDetectionNotificationUseCase> logger,
    TimeSpan? mediaFinalizationWindow = null) : IDetectionNotificationDispatcher
{
    private static readonly string[] DefaultAllowedLabels = ["person_unknown", "person_known"];
    private static readonly TimeSpan DefaultMediaFinalizationWindow = TimeSpan.FromSeconds(20);

    private readonly TimeSpan mediaWindow = mediaFinalizationWindow ?? DefaultMediaFinalizationWindow;

    public async Task<bool> ExecuteAsync(FrigateDetection detection, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(detection);

        var configs = await channelConfigs.GetAllAsync(ct);
        var sentSomewhere = false;

        foreach (var config in configs)
        {
            if (await SendOnAsync(config, detection, ct))
                sentSomewhere = true;
        }

        return sentSomewhere;
    }

    private async Task<bool> SendOnAsync(NotificationChannelConfig config, FrigateDetection detection, CancellationToken ct)
    {
        var sender = catalog.SenderFor(config.Channel);
        if (sender is null)
        {
            logger.LogWarning("No adapter for channel {Channel}: nothing sent for event {EventId}.",
                config.Channel, detection.EventId);
            return false;
        }

        if (!await ShouldNotifyAsync(config, sender.Descriptor, detection, ct))
            return false;

        var enabledFields = MessageFields.Parse(config.MessageFieldsJson);
        var message = formatter.Format(detection, enabledFields);

        Stream? photo = null;
        Stream? video = null;

        try
        {
            (photo, video) = await GatherMediaAsync(config, sender.Descriptor.Capabilities, enabledFields, detection, ct);

            logger.LogInformation(
                "Sending {Channel} notification for event {EventId} label={Label} photo={HasPhoto} video={HasVideo}",
                config.Channel, detection.EventId, detection.Label, photo is not null, video is not null);

            await sender.SendAsync(new OutgoingNotification(message, photo, video), config.Credentials, ct);
            await notifications.AddAsync(Journal(config.Channel, detection, NotificationStatus.Sent), ct);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Channel {Channel} refused event {EventId}.", config.Channel, detection.EventId);
            await notifications.AddAsync(Journal(config.Channel, detection, NotificationStatus.Failed, ex.Message), ct);
            return false;
        }
        finally
        {
            if (photo is not null) await photo.DisposeAsync();
            if (video is not null) await video.DisposeAsync();
        }
    }

    private async Task<bool> ShouldNotifyAsync(
        NotificationChannelConfig config,
        NotificationChannelDescriptor descriptor,
        FrigateDetection detection,
        CancellationToken ct)
    {
        if (!config.IsEnabled || !descriptor.IsSatisfiedBy(config.Credentials))
        {
            logger.LogDebug("{Channel} skipped for event {EventId}: channel not ready (enabled={IsEnabled})",
                config.Channel, detection.EventId, config.IsEnabled);
            return false;
        }

        var minimumConfidence = Math.Clamp(config.MinimumConfidence, 0f, 1f);
        if (detection.Confidence.HasValue && detection.Confidence.Value < minimumConfidence)
        {
            logger.LogDebug("{Channel} skipped for event {EventId}: confidence={Confidence:F2} < min={Min:F2}",
                config.Channel, detection.EventId, detection.Confidence.Value, minimumConfidence);
            return false;
        }

        var localHour = TimeZoneInfo.ConvertTime(detection.OccurredAt, timeZone).Hour;
        if (!IsWithinActiveHours(localHour, config.ActiveFromHour, config.ActiveToHour))
        {
            logger.LogDebug("{Channel} skipped for event {EventId}: hour={Hour} outside [{From}-{To}]",
                config.Channel, detection.EventId, localHour, config.ActiveFromHour, config.ActiveToHour);
            return false;
        }

        var allowedLabels = ParseAllowedLabels(config.AllowedLabelsJson);
        if (!IsLabelAllowed(detection.Label, detection.Identity, allowedLabels))
        {
            logger.LogDebug("{Channel} skipped for event {EventId}: label={Label} identity={Identity} not matched",
                config.Channel, detection.EventId, detection.Label, detection.Identity);
            return false;
        }

        if (await notifications.HasSentAsync(detection.EventId, config.Channel, ct))
        {
            logger.LogDebug("{Channel} skipped for event {EventId}: already sent", config.Channel, detection.EventId);
            return false;
        }

        if (config.CooldownMinutes is > 0)
        {
            var lastSent = await notifications.GetLastSentAtForAsync(
                config.Channel, detection.Camera, detection.Label, ct);
            if (lastSent.HasValue
                && (DateTimeOffset.UtcNow - lastSent.Value).TotalMinutes < config.CooldownMinutes.Value)
            {
                logger.LogDebug("{Channel} skipped for event {EventId}: cooldown {Minutes}min (last sent {LastSent})",
                    config.Channel, detection.EventId, config.CooldownMinutes.Value, lastSent.Value);
                return false;
            }
        }

        return true;
    }

    /// <summary>
    /// Collects what the user asked for, intersected with what the channel can carry. The clip is
    /// fetched first when it is wanted: it being written proves Frigate finalized the event, so the
    /// snapshot that follows needs no grace window of its own (ADR-49).
    /// </summary>
    private async Task<(Stream? Photo, Stream? Video)> GatherMediaAsync(
        NotificationChannelConfig config,
        ChannelCapabilities capabilities,
        IReadOnlySet<MessageField> enabledFields,
        FrigateDetection detection,
        CancellationToken ct)
    {
        if (config.MediaMode == MediaMode.Text || !enabledFields.Contains(MessageField.Snapshot))
            return (null, null);

        // has_clip/has_snapshot in the MQTT end payload are unreliable: Frigate may report false and
        // finalize the file seconds later. We attempt the fetch regardless and let the read retry.
        Stream? video = null;
        if (config.MediaMode == MediaMode.ClipOrPhoto && capabilities.Video)
        {
            video = await clipProvider.TryGetClipAsync(detection.EventId, mediaWindow, ct);
            if (video is null)
                logger.LogWarning("Clip unavailable for event {EventId} — falling back to snapshot", detection.EventId);
        }

        if (!capabilities.Photo)
            return (null, video);

        var window = video is null ? mediaWindow : TimeSpan.Zero;
        var photo = await imageProvider.TryGetImageAsync(detection.EventId, FrigateEventImage.Snapshot, window, ct);
        if (photo is null && video is null)
            logger.LogWarning("Snapshot unavailable for event {EventId} — falling back to text message", detection.EventId);

        return (photo, video);
    }

    private static Notification Journal(
        NotificationChannel channel, FrigateDetection detection, NotificationStatus status, string? error = null)
        => new()
        {
            FrigateEventId = detection.EventId,
            Channel = channel,
            Camera = detection.Camera,
            Label = detection.Label,
            Status = status,
            ErrorMessage = error
        };

    private static HashSet<string> ParseAllowedLabels(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return new HashSet<string>(DefaultAllowedLabels, StringComparer.OrdinalIgnoreCase);
        try
        {
            var labels = JsonSerializer.Deserialize<string[]>(json);
            return labels is { Length: > 0 }
                ? new HashSet<string>(labels, StringComparer.OrdinalIgnoreCase)
                : new HashSet<string>(DefaultAllowedLabels, StringComparer.OrdinalIgnoreCase);
        }
        catch (JsonException)
        {
            return new HashSet<string>(DefaultAllowedLabels, StringComparer.OrdinalIgnoreCase);
        }
    }

    // Maps a Frigate detection label + identity to its notification-semantic label.
    // "person" and "face" both resolve to person_unknown/person_known depending on identity.
    internal static string ResolveNotificationLabel(string label, string? identity) =>
        label.ToLowerInvariant() switch
        {
            "person" or "face" => string.IsNullOrWhiteSpace(identity) ? "person_unknown" : "person_known",
            var other          => other
        };

    internal static bool IsLabelAllowed(string label, string? identity, IReadOnlySet<string> allowedLabels)
    {
        var notificationLabel = ResolveNotificationLabel(label, identity);
        return allowedLabels.Contains(notificationLabel, StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Returns false only when both bounds are defined and <paramref name="localHour"/> falls outside them.
    /// Handles overnight ranges (e.g. from=22, to=6).
    /// </summary>
    internal static bool IsWithinActiveHours(int localHour, int? fromHour, int? toHour)
    {
        if (fromHour is null || toHour is null) return true;

        // Same-day range: 08:00 → 22:00
        if (fromHour <= toHour)
            return localHour >= fromHour && localHour < toHour;

        // Overnight range: 22:00 → 06:00
        return localHour >= fromHour || localHour < toHour;
    }
}
