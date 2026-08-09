using Vyzio.Application.DTOs.DetectionEvents;
using Vyzio.Application.DTOs.Hub;
using Vyzio.Application.DTOs.Profiles;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Hub;

public sealed class GetHubOverviewUseCase(
    GetRecentDetectionEventsUseCase recentDetections,
    IProfileRepository profiles,
    INotificationRepository notifications,
    INotificationChannelConfigRepository channelConfigs)
{
    private const string TelegramChannel = "telegram";

    public async Task<HubOverviewContract> ExecuteAsync(CancellationToken ct = default)
    {
        var profilesTask = profiles.GetAllAsync(ct);
        var sentCountTask = notifications.CountSentAsync(TelegramChannel, ct);
        var lastSentTask = notifications.GetLastSentAtAsync(TelegramChannel, ct);
        var telegramConfigTask = channelConfigs.GetByChannelAsync(TelegramChannel, ct);

        await Task.WhenAll(profilesTask, sentCountTask, lastSentTask, telegramConfigTask);

        var telegramConfig = telegramConfigTask.Result;
        var telegramConfigured = telegramConfig is { IsEnabled: true } && telegramConfig.HasCredentials;

        var warnings = new List<string>();
        if (!telegramConfigured)
            warnings.Add("Telegram n'est pas encore configure.");

        // La surveillance arretee, il n'y a plus de detections a lire : le reste de l'accueil tient debout.
        IReadOnlyList<DetectionEventContract> recentEvents;
        try
        {
            recentEvents = await recentDetections.ExecuteAsync(5, ct);
        }
        catch (HttpRequestException)
        {
            recentEvents = [];
            warnings.Add("Les dernieres detections sont indisponibles : la surveillance ne repond pas.");
        }

        return new HubOverviewContract(
            SystemHealthy: true,
            RecentEvents: recentEvents,
            Profiles: profilesTask.Result.Select(ProfileDto.From).Take(3).ToArray(),
            Notifications: new NotificationChannelSummaryContract(
                telegramConfigured,
                sentCountTask.Result,
                lastSentTask.Result),
            Warnings: warnings);
    }
}
