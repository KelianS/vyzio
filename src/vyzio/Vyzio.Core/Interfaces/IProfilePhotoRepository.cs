using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IProfilePhotoRepository
{
    Task<ProfilePhoto?> GetByIdAsync(string id, CancellationToken ct = default);
    Task<IReadOnlyList<ProfilePhoto>> GetByProfileIdAsync(string profileId, CancellationToken ct = default);
    Task<IReadOnlyList<ProfilePhoto>> GetUnsyncedAsync(CancellationToken ct = default);
    Task AddAsync(ProfilePhoto photo, CancellationToken ct = default);
    Task UpdateAsync(ProfilePhoto photo, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
}
