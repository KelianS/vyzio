using Vyzio.Application.DTOs.DetectionEvents;
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