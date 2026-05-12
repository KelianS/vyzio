using Vyzio.Application.DTOs.Hub;
using Vyzio.Application.DTOs.Profiles;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Hub;

public sealed class HubNotificationSettings(bool telegramConfigured)
{
    public bool TelegramConfigured { get; } = telegramConfigured;
}

public sealed class GetHubOverviewUseCase(
    IDetectionEventRepository detectionEvents,
    IProfileRepository profiles,
    INotificationRepository notifications,
    DetectionEventContractProjector projector,
    HubNotificationSettings notificationSettings)
{
    private const string TelegramChannel = "telegram";

    public async Task<HubOverviewContract> ExecuteAsync(CancellationToken ct = default)
    {
        var recentEventsTask = detectionEvents.GetRecentAsync(5, ct);
        var profilesTask = profiles.GetAllAsync(ct);
        var sentCountTask = notifications.CountSentAsync(TelegramChannel, ct);
        var lastSentTask = notifications.GetLastSentAtAsync(TelegramChannel, ct);

        await Task.WhenAll(recentEventsTask, profilesTask, sentCountTask, lastSentTask);

        var warnings = new List<string>();
        if (!notificationSettings.TelegramConfigured)
        {
            warnings.Add("Telegram n'est pas encore configure.");
        }

        return new HubOverviewContract(
            SystemHealthy: true,
            RecentEvents: projector.ToContracts(recentEventsTask.Result),
            Profiles: profilesTask.Result.Select(ProfileDto.From).Take(3).ToArray(),
            Notifications: new NotificationChannelSummaryContract(
                notificationSettings.TelegramConfigured,
                sentCountTask.Result,
                lastSentTask.Result),
            Warnings: warnings);
    }
}