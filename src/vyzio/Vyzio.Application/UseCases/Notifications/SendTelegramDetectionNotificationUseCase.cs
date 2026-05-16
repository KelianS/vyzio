using System.Text.Json;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Notifications;

public interface IDetectionNotificationDispatcher
{
    Task<bool> ExecuteAsync(DetectionEvent detectionEvent, CancellationToken ct = default);
}

public sealed class SendTelegramDetectionNotificationUseCase(
    INotificationRepository notifications,
    ITelegramNotificationSender telegramSender,
    INotificationChannelConfigRepository channelConfigs,
    IFrigateSnapshotProvider snapshotProvider,
    IFrigateClipProvider clipProvider,
    DetectionTelegramMessageFormatter formatter,
    ILogger<SendTelegramDetectionNotificationUseCase> logger,
    int clipFetchDelaySeconds = 10) : IDetectionNotificationDispatcher
{
    private const string TelegramChannel = "telegram";
    private static readonly string[] DefaultAllowedLabels = ["person"];

    public async Task<bool> ExecuteAsync(DetectionEvent detectionEvent, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(detectionEvent);

        // Only notify on lifecycle=end so the clip is available when has_clip=true (option B).
        if (!string.Equals(detectionEvent.Lifecycle, "end", StringComparison.OrdinalIgnoreCase))
        {
            logger.LogDebug("Telegram skipped for event {EventId}: lifecycle={Lifecycle} (waiting for end)", detectionEvent.Id, detectionEvent.Lifecycle);
            return false;
        }

        var config = await channelConfigs.GetByChannelAsync(TelegramChannel, ct);
        if (config is null || !config.IsEnabled || !config.HasCredentials)
        {
            logger.LogDebug("Telegram skipped for event {EventId}: channel not configured (isNull={IsNull} isEnabled={IsEnabled} hasCreds={HasCreds})",
                detectionEvent.Id, config is null, config?.IsEnabled, config?.HasCredentials);
            return false;
        }

        var minimumConfidence = Math.Clamp(config.MinimumConfidence, 0f, 1f);
        if (detectionEvent.Confidence.HasValue && detectionEvent.Confidence.Value < minimumConfidence)
        {
            logger.LogDebug("Telegram skipped for event {EventId}: confidence={Confidence:F2} < min={Min:F2}",
                detectionEvent.Id, detectionEvent.Confidence.Value, minimumConfidence);
            return false;
        }

        if (!IsWithinActiveHours(detectionEvent.OccurredAt.ToLocalTime().Hour, config.ActiveFromHour, config.ActiveToHour))
        {
            logger.LogDebug("Telegram skipped for event {EventId}: hour={Hour} outside [{From}-{To}]",
                detectionEvent.Id, detectionEvent.OccurredAt.ToLocalTime().Hour, config.ActiveFromHour, config.ActiveToHour);
            return false;
        }

        var allowedLabels = ParseAllowedLabels(config.AllowedLabelsJson);
        if (!allowedLabels.Contains(detectionEvent.Label, StringComparer.OrdinalIgnoreCase)
            && string.IsNullOrWhiteSpace(detectionEvent.Identity))
        {
            logger.LogDebug("Telegram skipped for event {EventId}: label={Label} not in [{AllowedLabels}] and no identity",
                detectionEvent.Id, detectionEvent.Label, string.Join(",", allowedLabels));
            return false;
        }

        if (await notifications.HasSentAsync(detectionEvent.Id, TelegramChannel, ct))
        {
            logger.LogDebug("Telegram skipped for event {EventId}: already sent", detectionEvent.Id);
            return false;
        }

        if (config.CooldownMinutes is > 0)
        {
            var lastSent = await notifications.GetLastSentAtForAsync(
                TelegramChannel, detectionEvent.Camera, detectionEvent.Label, ct);
            if (lastSent.HasValue
                && (DateTimeOffset.UtcNow - lastSent.Value).TotalMinutes < config.CooldownMinutes.Value)
            {
                logger.LogDebug(
                    "Telegram skipped for event {EventId}: cooldown {Minutes}min (last sent {LastSent})",
                    detectionEvent.Id, config.CooldownMinutes.Value, lastSent.Value);
                return false;
            }
        }

        var enabledFields = ParseMessageFields(config.MessageFieldsJson);
        var mediaMode = config.MediaMode ?? "clip_or_photo";

        logger.LogInformation("Sending Telegram notification for event {EventId} label={Label} hasClip={HasClip} hasSnapshot={HasSnapshot} mediaMode={MediaMode}",
            detectionEvent.Id, detectionEvent.Label, detectionEvent.HasClip, detectionEvent.HasSnapshot, mediaMode);

        try
        {
            var caption = formatter.Format(detectionEvent, enabledFields);

            // has_clip/has_snapshot in the MQTT end payload are unreliable: Frigate may report false
            // and finalize the file a few seconds later. We always attempt the fetch after the delay,
            // regardless of the flags, and fall through on 404.
            var wantMedia = mediaMode != "text" && enabledFields.Contains(MessageField.Snapshot);

            if (wantMedia && clipFetchDelaySeconds > 0)
            {
                logger.LogDebug("Waiting {Seconds}s for Frigate to finalize media for event {EventId}",
                    clipFetchDelaySeconds, detectionEvent.Id);
                await Task.Delay(TimeSpan.FromSeconds(clipFetchDelaySeconds), ct);
            }

            // Priority 1: send clip as video when mode allows it.
            if (mediaMode == "clip_or_photo" && enabledFields.Contains(MessageField.Snapshot))
            {
                var clip = await clipProvider.TryGetClipAsync(detectionEvent.FrigateEventId, ct);
                if (clip is not null)
                {
                    logger.LogInformation("Sending Telegram video for event {EventId}", detectionEvent.Id);
                    var thumbnail = await snapshotProvider.TryGetSnapshotAsync(detectionEvent.FrigateEventId, ct);
                    try
                    {
                        await telegramSender.SendVideoAsync(clip, thumbnail, caption, config.BotToken!, config.ChatId!, ct);
                    }
                    finally
                    {
                        await clip.DisposeAsync();
                        if (thumbnail is not null) await thumbnail.DisposeAsync();
                    }
                    await notifications.AddAsync(new Notification
                    {
                        EventId = detectionEvent.Id,
                        Channel = TelegramChannel,
                        Status = "sent"
                    }, ct);
                    return true;
                }
                logger.LogWarning("Clip unavailable for event {EventId} — falling back to snapshot", detectionEvent.Id);
            }

            // Photo: send snapshot when mode allows it.
            if (mediaMode is "clip_or_photo" or "photo" && enabledFields.Contains(MessageField.Snapshot))
            {
                var snapshot = await snapshotProvider.TryGetSnapshotAsync(detectionEvent.FrigateEventId, ct);
                if (snapshot is not null)
                {
                    logger.LogInformation("Sending Telegram photo for event {EventId}", detectionEvent.Id);
                    await using (snapshot)
                        await telegramSender.SendPhotoAsync(snapshot, caption, config.BotToken!, config.ChatId!, ct);
                    await notifications.AddAsync(new Notification
                    {
                        EventId = detectionEvent.Id,
                        Channel = TelegramChannel,
                        Status = "sent"
                    }, ct);
                    return true;
                }
                logger.LogWarning("Snapshot unavailable for event {EventId} — falling back to text message", detectionEvent.Id);
            }

            // Final fallback (or mediaMode="text"): text only.
            await telegramSender.SendAsync(caption, config.BotToken!, config.ChatId!, ct);
            await notifications.AddAsync(new Notification
            {
                EventId = detectionEvent.Id,
                Channel = TelegramChannel,
                Status = "sent"
            }, ct);
            return true;
        }
        catch (Exception ex)
        {
            await notifications.AddAsync(new Notification
            {
                EventId = detectionEvent.Id,
                Channel = TelegramChannel,
                Status = "failed",
                ErrorMessage = ex.Message
            }, ct);
            return false;
        }
    }

    private static HashSet<string> ParseMessageFields(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return MessageField.All;
        try
        {
            return JsonSerializer.Deserialize<string[]>(json) is { Length: > 0 } fields
                ? new HashSet<string>(fields, StringComparer.OrdinalIgnoreCase)
                : MessageField.All;
        }
        catch
        {
            return MessageField.All;
        }
    }

    private static string[] ParseAllowedLabels(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return DefaultAllowedLabels;
        try
        {
            return JsonSerializer.Deserialize<string[]>(json) is { Length: > 0 } labels
                ? labels
                : DefaultAllowedLabels;
        }
        catch
        {
            return DefaultAllowedLabels;
        }
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

public static class MessageField
{
    public const string Camera = "camera";
    public const string Time = "time";
    public const string Label = "label";
    public const string Confidence = "confidence";
    public const string Snapshot = "snapshot";

    public static readonly HashSet<string> All = new(StringComparer.OrdinalIgnoreCase)
        { Camera, Time, Label, Confidence, Snapshot };
}

public sealed class DetectionTelegramMessageFormatter
{
    public string Format(DetectionEvent detectionEvent, IReadOnlySet<string>? enabledFields = null)
    {
        ArgumentNullException.ThrowIfNull(detectionEvent);
        enabledFields ??= MessageField.All;

        var hasLabel = enabledFields.Contains(MessageField.Label);
        var subject = string.IsNullOrWhiteSpace(detectionEvent.Identity)
            ? (hasLabel ? $"Detection {detectionEvent.Label}" : "Detection")
            : $"{detectionEvent.Identity} detectee";

        var parts = new List<string> { subject };

        if (enabledFields.Contains(MessageField.Camera))
            parts.Add(detectionEvent.Camera.Replace('_', ' '));

        if (enabledFields.Contains(MessageField.Time))
            parts.Add(detectionEvent.OccurredAt.ToLocalTime().ToString("HH:mm"));

        if (enabledFields.Contains(MessageField.Confidence) && detectionEvent.Confidence.HasValue)
            parts.Add($"{(int)Math.Round(detectionEvent.Confidence.Value * 100)} %");

        return string.Join(" — ", parts);
    }
}
