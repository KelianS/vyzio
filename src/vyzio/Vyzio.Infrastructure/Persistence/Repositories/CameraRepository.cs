using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Persistence.Repositories;

public sealed class CameraRepository(VyzioDbContext db) : ICameraRepository
{
    public async Task<IReadOnlyList<Camera>> GetAllAsync(CancellationToken ct = default)
        => await db.Cameras
            .OrderBy(camera => camera.DisplayName)
            .ToListAsync(ct);

    public Task<Camera?> GetByIdAsync(string id, CancellationToken ct = default)
        => db.Cameras.FirstOrDefaultAsync(camera => camera.Id == id, ct);

    public Task<Camera?> GetBySlugAsync(string slug, CancellationToken ct = default)
        => db.Cameras.FirstOrDefaultAsync(camera => camera.Slug == slug, ct);

    public async Task AddAsync(Camera camera, CancellationToken ct = default)
    {
        db.Cameras.Add(camera);
        await db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(Camera camera, CancellationToken ct = default)
    {
        db.Cameras.Update(camera);
        await db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Camera camera, CancellationToken ct = default)
    {
        db.Cameras.Remove(camera);
        await db.SaveChangesAsync(ct);
    }
}