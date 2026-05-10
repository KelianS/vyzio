using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IObservedEventRepository
{
    Task<ObservedEvent?> GetByIdAsync(string id, CancellationToken ct = default);
    Task<ObservedEvent?> GetByFrigateEventIdAsync(string frigateEventId, CancellationToken ct = default);
    Task<IReadOnlyList<ObservedEvent>> GetRecentAsync(int limit, CancellationToken ct = default);
    Task<IReadOnlyList<ObservedEvent>> GetByProfileAsync(string profileId, int limit, CancellationToken ct = default);
    Task AddAsync(ObservedEvent evt, CancellationToken ct = default);
    Task UpdateAsync(ObservedEvent evt, CancellationToken ct = default);
}