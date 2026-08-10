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
    INotificationChannelConfigRepository channelConfigs,
    INotificationChannelCatalog catalog)
{
    public async Task<HubOverviewContract> ExecuteAsync(CancellationToken ct = default)
    {
        var profilesTask = profiles.GetAllAsync(ct);
        var sentCountTask = notifications.CountSentAsync(ct);
        var lastSentTask = notifications.GetLastSentAtAsync(ct);
        var configsTask = channelConfigs.GetAllAsync(ct);

        await Task.WhenAll(profilesTask, sentCountTask, lastSentTask, configsTask);

        var activeChannels = configsTask.Result.Count(config =>
            config.IsEnabled && catalog.Describe(config.Channel)?.IsSatisfiedBy(config.Credentials) == true);

        var warnings = new List<string>();
        if (activeChannels == 0)
            warnings.Add("Aucun canal de notification n'est configure.");

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
                activeChannels,
                sentCountTask.Result,
                lastSentTask.Result),
            Warnings: warnings);
    }
}
