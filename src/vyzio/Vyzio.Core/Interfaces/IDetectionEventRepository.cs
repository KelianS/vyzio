using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IDetectionEventRepository
{
    Task<DetectionEvent?> GetByFrigateEventIdAsync(string frigateEventId, CancellationToken ct = default);
    Task AddAsync(DetectionEvent evt, CancellationToken ct = default);
    Task UpdateAsync(DetectionEvent evt, CancellationToken ct = default);
    Task UpdateIdentityAsync(string id, string? identity, string? profileId, CancellationToken ct = default);
}
