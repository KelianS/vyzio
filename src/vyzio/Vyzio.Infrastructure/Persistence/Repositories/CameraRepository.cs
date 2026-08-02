using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Persistence.Repositories;

public sealed class CameraRepository(VyzioDbContext db) : ICameraRepository
{
    // Streams are always loaded: Camera.StreamPath, MainStream and DetectStream all resolve through
    // them (ADR-38), so a camera without its streams is a camera without a video source.
    public async Task<IReadOnlyList<Camera>> GetAllAsync(CancellationToken ct = default)
        => await db.Cameras
            .Include(camera => camera.Streams)
            .OrderBy(camera => camera.DisplayName)
            .ToListAsync(ct);

    public Task<Camera?> GetByIdAsync(string id, CancellationToken ct = default)
        => db.Cameras
            .Include(camera => camera.Streams)
            .FirstOrDefaultAsync(camera => camera.Id == id, ct);

    public Task<Camera?> GetBySlugAsync(string slug, CancellationToken ct = default)
        => db.Cameras
            .Include(camera => camera.Streams)
            .FirstOrDefaultAsync(camera => camera.Slug == slug, ct);

    public async Task AddAsync(Camera camera, CancellationToken ct = default)
    {
        db.Cameras.Add(camera);
        await db.SaveChangesAsync(ct);
    }

    // A camera that came from this context is already tracked, and its change tracker knows which
    // streams were added or removed. Calling Update() on it would flatten the whole graph to
    // Modified and turn a newly added stream into an UPDATE against a row that does not exist yet.
    public async Task UpdateAsync(Camera camera, CancellationToken ct = default)
    {
        if (db.Entry(camera).State == EntityState.Detached)
        {
            db.Cameras.Update(camera);
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Camera camera, CancellationToken ct = default)
    {
        db.Cameras.Remove(camera);
        await db.SaveChangesAsync(ct);
    }
}