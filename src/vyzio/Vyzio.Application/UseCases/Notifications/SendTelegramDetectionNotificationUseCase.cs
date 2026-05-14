using System.Text.Json;
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
    DetectionTelegramMessageFormatter formatter) : IDetectionNotificationDispatcher
{
    private const string TelegramChannel = "telegram";
    private static readonly string[] DefaultAllowedLabels = ["person"];

    public async Task<bool> ExecuteAsync(DetectionEvent detectionEvent, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(detectionEvent);

        var config = await channelConfigs.GetByChannelAsync(TelegramChannel, ct);
        if (config is null || !config.IsEnabled || !config.HasCredentials)
            return false;

        if (!string.Equals(detectionEvent.Lifecycle, "new", StringComparison.OrdinalIgnoreCase))
            return false;

        var minimumConfidence = Math.Clamp(config.MinimumConfidence, 0f, 1f);
        if (detectionEvent.Confidence.HasValue && detectionEvent.Confidence.Value < minimumConfidence)
            return false;

        var allowedLabels = ParseAllowedLabels(config.AllowedLabelsJson);
        if (!allowedLabels.Contains(detectionEvent.Label, StringComparer.OrdinalIgnoreCase)
            && string.IsNullOrWhiteSpace(detectionEvent.Identity))
            return false;

        if (await notifications.HasSentAsync(detectionEvent.Id, TelegramChannel, ct))
            return false;

        try
        {
            await telegramSender.SendAsync(formatter.Format(detectionEvent), config.BotToken!, config.ChatId!, ct);
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
}

public sealed class DetectionTelegramMessageFormatter
{
    public string Format(DetectionEvent detectionEvent)
    {
        ArgumentNullException.ThrowIfNull(detectionEvent);

        var subject = string.IsNullOrWhiteSpace(detectionEvent.Identity)
            ? $"Detection {detectionEvent.Label}"
            : $"{detectionEvent.Identity} detectee";

        var camera = detectionEvent.Camera.Replace('_', ' ');
        return $"{subject} - {camera} - {detectionEvent.OccurredAt:HH:mm}";
    }
}
