using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IProfileRepository
{
    Task<Profile?> GetByIdAsync(string id, CancellationToken ct = default);
    Task<IReadOnlyList<Profile>> GetAllAsync(CancellationToken ct = default);
    Task AddAsync(Profile profile, CancellationToken ct = default);
    Task UpdateAsync(Profile profile, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
}
