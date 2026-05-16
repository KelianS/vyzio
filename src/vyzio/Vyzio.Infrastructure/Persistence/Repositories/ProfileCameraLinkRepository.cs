using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Persistence;

namespace Vyzio.Infrastructure.Persistence.Repositories;

public sealed class ProfileCameraLinkRepository(VyzioDbContext db) : IProfileCameraLinkRepository
{
    public async Task<IReadOnlyList<ProfileCameraLink>> GetByCameraIdAsync(string cameraId, CancellationToken ct = default)
        => await db.ProfileCameraLinks
            .Where(l => l.CameraId == cameraId)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<ProfileCameraLink>> GetByProfileIdAsync(string profileId, CancellationToken ct = default)
        => await db.ProfileCameraLinks
            .Where(l => l.ProfileId == profileId)
            .ToListAsync(ct);

    public Task<ProfileCameraLink?> GetByProfileAndCameraAsync(string profileId, string cameraId, CancellationToken ct = default)
        => db.ProfileCameraLinks
            .FirstOrDefaultAsync(l => l.ProfileId == profileId && l.CameraId == cameraId, ct);

    public async Task UpsertAsync(ProfileCameraLink link, CancellationToken ct = default)
    {
        var existing = await GetByProfileAndCameraAsync(link.ProfileId, link.CameraId, ct);
        if (existing is null)
        {
            db.ProfileCameraLinks.Add(link);
        }
        else
        {
            existing.Enabled = link.Enabled;
            db.ProfileCameraLinks.Update(existing);
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task DeleteByProfileAndCameraAsync(string profileId, string cameraId, CancellationToken ct = default)
    {
        var link = await GetByProfileAndCameraAsync(profileId, cameraId, ct);
        if (link is not null)
        {
            db.ProfileCameraLinks.Remove(link);
            await db.SaveChangesAsync(ct);
        }
    }
}
