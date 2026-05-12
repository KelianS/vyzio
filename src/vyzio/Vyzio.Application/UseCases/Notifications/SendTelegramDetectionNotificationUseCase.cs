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
    TelegramDetectionNotificationPolicy policy,
    DetectionTelegramMessageFormatter formatter) : IDetectionNotificationDispatcher
{
    private const string TelegramChannel = "telegram";

    public async Task<bool> ExecuteAsync(DetectionEvent detectionEvent, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(detectionEvent);

        if (!policy.ShouldNotify(detectionEvent))
        {
            return false;
        }

        if (await notifications.HasSentAsync(detectionEvent.Id, TelegramChannel, ct))
        {
            return false;
        }

        try
        {
            await telegramSender.SendAsync(formatter.Format(detectionEvent), ct);
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
}

public sealed class TelegramDetectionNotificationPolicy(bool telegramEnabled, float minimumConfidence)
{
    private readonly float _minimumConfidence = Math.Clamp(minimumConfidence, 0f, 1f);

    public bool ShouldNotify(DetectionEvent detectionEvent)
    {
        ArgumentNullException.ThrowIfNull(detectionEvent);

        if (!telegramEnabled)
        {
            return false;
        }

        if (!string.Equals(detectionEvent.Lifecycle, "new", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (!string.Equals(detectionEvent.Label, "person", StringComparison.OrdinalIgnoreCase)
            && string.IsNullOrWhiteSpace(detectionEvent.Identity))
        {
            return false;
        }

        return !detectionEvent.Confidence.HasValue || detectionEvent.Confidence.Value >= _minimumConfidence;
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