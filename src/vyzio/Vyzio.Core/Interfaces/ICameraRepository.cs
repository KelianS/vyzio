using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface ICameraRepository
{
    Task<IReadOnlyList<Camera>> GetAllAsync(CancellationToken ct = default);
    Task<Camera?> GetByIdAsync(string id, CancellationToken ct = default);
    Task<Camera?> GetBySlugAsync(string slug, CancellationToken ct = default);
    Task AddAsync(Camera camera, CancellationToken ct = default);
    Task UpdateAsync(Camera camera, CancellationToken ct = default);
    Task DeleteAsync(Camera camera, CancellationToken ct = default);
}