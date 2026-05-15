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
    DetectionTelegramMessageFormatter formatter,
    ILogger<SendTelegramDetectionNotificationUseCase> logger) : IDetectionNotificationDispatcher
{
    private const string TelegramChannel = "telegram";
    private static readonly string[] DefaultAllowedLabels = ["person"];

    public async Task<bool> ExecuteAsync(DetectionEvent detectionEvent, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(detectionEvent);

        var config = await channelConfigs.GetByChannelAsync(TelegramChannel, ct);
        if (config is null || !config.IsEnabled || !config.HasCredentials)
        {
            logger.LogDebug("Telegram skipped for event {EventId}: channel not configured (isNull={IsNull} isEnabled={IsEnabled} hasCreds={HasCreds})",
                detectionEvent.Id, config is null, config?.IsEnabled, config?.HasCredentials);
            return false;
        }

        if (!string.Equals(detectionEvent.Lifecycle, "new", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(detectionEvent.Lifecycle, "update", StringComparison.OrdinalIgnoreCase))
        {
            logger.LogDebug("Telegram skipped for event {EventId}: lifecycle={Lifecycle}", detectionEvent.Id, detectionEvent.Lifecycle);
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

        // Parse fields early so we can check the snapshot preference before committing to send.
        var enabledFields = ParseMessageFields(config.MessageFieldsJson);

        // On the very first frame ("new"), the snapshot is often not yet written by Frigate.
        // If the snapshot field is enabled and the snapshot is not ready, defer until an
        // "update" frame arrives with has_snapshot=true. This ensures the notification
        // always carries a photo when available.
        if (string.Equals(detectionEvent.Lifecycle, "new", StringComparison.OrdinalIgnoreCase)
            && enabledFields.Contains(MessageField.Snapshot)
            && !detectionEvent.HasSnapshot)
        {
            logger.LogDebug("Telegram deferred for event {EventId}: lifecycle=new, snapshot not ready yet", detectionEvent.Id);
            return false;
        }

        if (await notifications.HasSentAsync(detectionEvent.Id, TelegramChannel, ct))
        {
            logger.LogDebug("Telegram skipped for event {EventId}: already sent", detectionEvent.Id);
            return false;
        }

        logger.LogInformation("Sending Telegram notification for event {EventId} label={Label} lifecycle={Lifecycle} hasSnapshot={HasSnapshot}",
            detectionEvent.Id, detectionEvent.Label, detectionEvent.Lifecycle, detectionEvent.HasSnapshot);

        try
        {
            var caption = formatter.Format(detectionEvent, enabledFields);

            if (detectionEvent.HasSnapshot && enabledFields.Contains(MessageField.Snapshot))
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
            else
            {
                logger.LogDebug("Skipping snapshot for event {EventId}: hasSnapshot={HasSnapshot} snapshotField={SnapshotEnabled}",
                    detectionEvent.Id, detectionEvent.HasSnapshot, enabledFields.Contains(MessageField.Snapshot));
            }

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
