using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IDetectionEventRepository
{
    Task<DetectionEvent?> GetByIdAsync(string id, CancellationToken ct = default);
    Task<DetectionEvent?> GetByFrigateEventIdAsync(string frigateEventId, CancellationToken ct = default);
    Task<IReadOnlyList<DetectionEvent>> GetRecentAsync(int limit, CancellationToken ct = default);
    Task<IReadOnlyList<DetectionEvent>> GetByProfileAsync(string profileId, int limit, CancellationToken ct = default);
    Task<(IReadOnlyList<DetectionEvent> Items, int Total)> GetPagedAsync(DetectionHistoryQuery query, CancellationToken ct = default);
    Task AddAsync(DetectionEvent evt, CancellationToken ct = default);
    Task UpdateAsync(DetectionEvent evt, CancellationToken ct = default);
    Task UpdateIdentityAsync(string id, string? identity, string? profileId, CancellationToken ct = default);
}
