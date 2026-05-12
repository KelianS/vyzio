using Vyzio.Application.DTOs.DetectionEvents;
using Vyzio.Application.DTOs.Profiles;

namespace Vyzio.Application.DTOs.Hub;

public sealed record NotificationChannelSummaryContract(
    bool TelegramConfigured,
    int SentCount,
    DateTimeOffset? LastSentAt);

public sealed record HubOverviewContract(
    bool SystemHealthy,
    IReadOnlyList<DetectionEventContract> RecentEvents,
    IReadOnlyList<ProfileDto> Profiles,
    NotificationChannelSummaryContract Notifications,
    IReadOnlyList<string> Warnings);