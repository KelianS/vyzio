using System.Text.Json;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Notifications;

public interface IDetectionNotificationDispatcher
{
    Task<bool> ExecuteAsync(FrigateDetection detection, CancellationToken ct = default);
}

public sealed class SendTelegramDetectionNotificationUseCase(
    INotificationRepository notifications,
    ITelegramNotificationSender telegramSender,
    INotificationChannelConfigRepository channelConfigs,
    IFrigateEventImageProvider imageProvider,
    IFrigateClipProvider clipProvider,
    DetectionTelegramMessageFormatter formatter,
    TimeZoneInfo timeZone,
    ILogger<SendTelegramDetectionNotificationUseCase> logger,
    TimeSpan? mediaFinalizationWindow = null) : IDetectionNotificationDispatcher
{
    private const string TelegramChannel = "telegram";
    private static readonly string[] DefaultAllowedLabels = ["person_unknown", "person_known"];
    private static readonly TimeSpan DefaultMediaFinalizationWindow = TimeSpan.FromSeconds(20);

    private readonly TimeSpan mediaWindow = mediaFinalizationWindow ?? DefaultMediaFinalizationWindow;

    public async Task<bool> ExecuteAsync(FrigateDetection detection, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(detection);

        var config = await channelConfigs.GetByChannelAsync(TelegramChannel, ct);
        if (config is null || !config.IsEnabled || !config.HasCredentials)
        {
            logger.LogDebug("Telegram skipped for event {EventId}: channel not configured (isNull={IsNull} isEnabled={IsEnabled} hasCreds={HasCreds})",
                detection.EventId, config is null, config?.IsEnabled, config?.HasCredentials);
            return false;
        }

        var minimumConfidence = Math.Clamp(config.MinimumConfidence, 0f, 1f);
        if (detection.Confidence.HasValue && detection.Confidence.Value < minimumConfidence)
        {
            logger.LogDebug("Telegram skipped for event {EventId}: confidence={Confidence:F2} < min={Min:F2}",
                detection.EventId, detection.Confidence.Value, minimumConfidence);
            return false;
        }

        var localHour = TimeZoneInfo.ConvertTime(detection.OccurredAt, timeZone).Hour;
        if (!IsWithinActiveHours(localHour, config.ActiveFromHour, config.ActiveToHour))
        {
            logger.LogDebug("Telegram skipped for event {EventId}: hour={Hour} outside [{From}-{To}]",
                detection.EventId, localHour, config.ActiveFromHour, config.ActiveToHour);
            return false;
        }

        var allowedLabels = ParseAllowedLabels(config.AllowedLabelsJson);
        if (!IsLabelAllowed(detection.Label, detection.Identity, allowedLabels))
        {
            logger.LogDebug("Telegram skipped for event {EventId}: label={Label} identity={Identity} not matched by [{AllowedLabels}]",
                detection.EventId, detection.Label, detection.Identity, string.Join(",", allowedLabels));
            return false;
        }

        if (await notifications.HasSentAsync(detection.EventId, TelegramChannel, ct))
        {
            logger.LogDebug("Telegram skipped for event {EventId}: already sent", detection.EventId);
            return false;
        }

        if (config.CooldownMinutes is > 0)
        {
            var lastSent = await notifications.GetLastSentAtForAsync(
                TelegramChannel, detection.Camera, detection.Label, ct);
            if (lastSent.HasValue
                && (DateTimeOffset.UtcNow - lastSent.Value).TotalMinutes < config.CooldownMinutes.Value)
            {
                logger.LogDebug(
                    "Telegram skipped for event {EventId}: cooldown {Minutes}min (last sent {LastSent})",
                    detection.EventId, config.CooldownMinutes.Value, lastSent.Value);
                return false;
            }
        }

        var enabledFields = ParseMessageFields(config.MessageFieldsJson);
        var mediaMode = config.MediaMode ?? "clip_or_photo";

        logger.LogInformation("Sending Telegram notification for event {EventId} label={Label} hasClip={HasClip} hasSnapshot={HasSnapshot} mediaMode={MediaMode}",
            detection.EventId, detection.Label, detection.HasClip, detection.HasSnapshot, mediaMode);

        try
        {
            var caption = formatter.Format(detection, enabledFields);

            // has_clip/has_snapshot in the MQTT end payload are unreliable: Frigate may report false
            // and finalize the file a few seconds later. We always attempt the fetch, regardless of
            // the flags, and let the read retry until the file exists or the window closes (ADR-49).

            // Priority 1: send clip + snapshot as media group (album) when mode allows it.
            if (mediaMode == "clip_or_photo" && enabledFields.Contains(MessageField.Snapshot))
            {
                var clip = await clipProvider.TryGetClipAsync(detection.EventId, mediaWindow, ct);
                if (clip is not null)
                {
                    // The clip being written proves Frigate finalized the event: no window left to grant.
                    var snapshot = await imageProvider.TryGetImageAsync(
                        detection.EventId, FrigateEventImage.Snapshot, ct: ct);
                    if (snapshot is not null)
                    {
                        logger.LogInformation("Sending Telegram media group for event {EventId}", detection.EventId);
                        try
                        {
                            await telegramSender.SendMediaGroupAsync(snapshot, clip, caption, config.BotToken!, config.ChatId!, ct);
                        }
                        finally
                        {
                            await snapshot.DisposeAsync();
                            await clip.DisposeAsync();
                        }
                    }
                    else
                    {
                        logger.LogInformation("Sending Telegram video (no snapshot) for event {EventId}", detection.EventId);
                        try
                        {
                            await telegramSender.SendVideoAsync(clip, null, caption, config.BotToken!, config.ChatId!, ct);
                        }
                        finally
                        {
                            await clip.DisposeAsync();
                        }
                    }
                    await notifications.AddAsync(Journal(detection, "sent"), ct);
                    return true;
                }
                logger.LogWarning("Clip unavailable for event {EventId} — falling back to snapshot", detection.EventId);
            }

            // Photo: send snapshot when mode allows it.
            if (mediaMode is "clip_or_photo" or "photo" && enabledFields.Contains(MessageField.Snapshot))
            {
                var snapshot = await imageProvider.TryGetImageAsync(
                    detection.EventId, FrigateEventImage.Snapshot, mediaWindow, ct);
                if (snapshot is not null)
                {
                    logger.LogInformation("Sending Telegram photo for event {EventId}", detection.EventId);
                    await using (snapshot)
                        await telegramSender.SendPhotoAsync(snapshot, caption, config.BotToken!, config.ChatId!, ct);
                    await notifications.AddAsync(Journal(detection, "sent"), ct);
                    return true;
                }
                logger.LogWarning("Snapshot unavailable for event {EventId} — falling back to text message", detection.EventId);
            }

            // Final fallback (or mediaMode="text"): text only.
            await telegramSender.SendAsync(caption, config.BotToken!, config.ChatId!, ct);
            await notifications.AddAsync(Journal(detection, "sent"), ct);
            return true;
        }
        catch (Exception ex)
        {
            await notifications.AddAsync(Journal(detection, "failed", ex.Message), ct);
            return false;
        }
    }

    private static Notification Journal(FrigateDetection detection, string status, string? error = null)
        => new()
        {
            FrigateEventId = detection.EventId,
            Channel = TelegramChannel,
            Camera = detection.Camera,
            Label = detection.Label,
            Status = status,
            ErrorMessage = error
        };

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
        catch
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
    private readonly TimeZoneInfo _timeZone;

    public DetectionTelegramMessageFormatter() : this(TimeZoneInfo.Local) { }

    public DetectionTelegramMessageFormatter(TimeZoneInfo timeZone)
    {
        _timeZone = timeZone;
    }

    public string Format(FrigateDetection detection, IReadOnlySet<string>? enabledFields = null)
    {
        ArgumentNullException.ThrowIfNull(detection);
        enabledFields ??= MessageField.All;

        var hasIdentity = !string.IsNullOrWhiteSpace(detection.Identity);
        var hasLabel = enabledFields.Contains(MessageField.Label);

        var emoji = hasIdentity ? "🧑" : GetLabelEmoji(detection.Label);
        var subject = hasIdentity
            ? $"{Encode(detection.Identity!)} detectee"
            : (hasLabel ? $"Detection {Encode(detection.Label)}" : "Detection");

        var meta = new List<string>();

        if (enabledFields.Contains(MessageField.Camera))
            meta.Add($"📷 {Encode(detection.Camera.Replace('_', ' '))}");

        if (enabledFields.Contains(MessageField.Time))
            meta.Add($"🕐 {TimeZoneInfo.ConvertTime(detection.OccurredAt, _timeZone):HH:mm}");

        if (enabledFields.Contains(MessageField.Confidence) && detection.Confidence.HasValue)
            meta.Add($"{(int)Math.Round(detection.Confidence.Value * 100)} %");

        var text = $"{emoji} <b>{subject}</b>";
        if (meta.Count > 0)
            text += $"\n{string.Join("  ·  ", meta)}";

        return text;
    }

    private static string Encode(string value) => System.Net.WebUtility.HtmlEncode(value);

    private static string GetLabelEmoji(string label) => label.ToLowerInvariant() switch
    {
        "person"       => "🚶",
        "person_known" => "🧑",
        "face"         => "👤",
        "cat"          => "🐱",
        "dog"          => "🐕",
        "car"          => "🚗",
        "bicycle"      => "🚲",
        "motorcycle"   => "🏍",
        "truck"        => "🚛",
        "bird"         => "🐦",
        "deer"         => "🦌",
        _              => "📡"
    };
}
