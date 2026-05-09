using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IRecognitionEventRepository
{
    Task<RecognitionEvent?> GetByIdAsync(string id, CancellationToken ct = default);
    Task<RecognitionEvent?> GetByFrigateEventIdAsync(string frigateEventId, CancellationToken ct = default);
    Task<IReadOnlyList<RecognitionEvent>> GetRecentAsync(int limit, CancellationToken ct = default);
    Task<IReadOnlyList<RecognitionEvent>> GetByProfileAsync(string profileId, int limit, CancellationToken ct = default);
    Task AddAsync(RecognitionEvent evt, CancellationToken ct = default);
    Task UpdateAsync(RecognitionEvent evt, CancellationToken ct = default);
}
