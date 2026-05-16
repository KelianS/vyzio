using Vyzio.Application.DTOs.DetectionEvents;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.DetectionEvents;

public sealed class GetRecentDetectionEventsUseCase(
    IDetectionEventRepository detectionEvents,
    DetectionEventContractProjector projector)
{
    public async Task<IReadOnlyList<DetectionEventContract>> ExecuteAsync(int limit = 20, CancellationToken ct = default)
    {
        var normalizedLimit = Math.Clamp(limit, 1, 100);
        var recentEvents = await detectionEvents.GetRecentAsync(normalizedLimit, ct);
        return projector.ToContracts(recentEvents);
    }
}

public sealed class GetProfileDetectionEventsUseCase(
    IDetectionEventRepository detectionEvents,
    DetectionEventContractProjector projector)
{
    public async Task<IReadOnlyList<DetectionEventContract>> ExecuteAsync(
        string profileId,
        int limit = 20,
        CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(profileId);

        var normalizedLimit = Math.Clamp(limit, 1, 100);
        var profileEvents = await detectionEvents.GetByProfileAsync(profileId, normalizedLimit, ct);
        return projector.ToContracts(profileEvents);
    }
}

public sealed class GetDetectionHistoryUseCase(
    IDetectionEventRepository detectionEvents,
    DetectionEventContractProjector projector)
{
    public async Task<PagedDetectionHistoryDto> ExecuteAsync(
        DetectionHistoryQuery query,
        CancellationToken ct = default)
    {
        var (items, total) = await detectionEvents.GetPagedAsync(query, ct);
        var limit = Math.Clamp(query.Limit, 1, 100);
        var page = Math.Max(query.Page, 1);
        var totalPages = total == 0 ? 0 : (int)Math.Ceiling((double)total / limit);

        return new PagedDetectionHistoryDto(
            projector.ToContracts(items),
            total,
            page,
            limit,
            totalPages);
    }
}

public sealed class CorrectDetectionIdentityUseCase(
    IDetectionEventRepository detectionEvents,
    IProfileRepository profiles)
{
    public async Task<bool> ExecuteAsync(
        string eventId,
        CorrectDetectionIdentityRequest request,
        CancellationToken ct = default)
    {
        var evt = await detectionEvents.GetByIdAsync(eventId, ct);
        if (evt is null)
            return false;

        string? identity = null;
        string? profileId = null;

        if (!string.IsNullOrWhiteSpace(request.ProfileId))
        {
            var profile = await profiles.GetByIdAsync(request.ProfileId, ct);
            if (profile is null)
                return false;

            identity = profile.Name;
            profileId = profile.Id;
        }

        await detectionEvents.UpdateIdentityAsync(eventId, identity, profileId, ct);
        return true;
    }
}