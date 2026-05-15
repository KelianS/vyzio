using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Persistence;

namespace Vyzio.Infrastructure.Persistence.Repositories;

public sealed class ProfilePhotoRepository(VyzioDbContext db) : IProfilePhotoRepository
{
    public Task<ProfilePhoto?> GetByIdAsync(string id, CancellationToken ct = default)
        => db.ProfilePhotos.FirstOrDefaultAsync(p => p.Id == id, ct);

    public async Task<IReadOnlyList<ProfilePhoto>> GetByProfileIdAsync(string profileId, CancellationToken ct = default)
        => await db.ProfilePhotos
            .Where(p => p.ProfileId == profileId)
            .OrderBy(p => p.CreatedAt)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<ProfilePhoto>> GetUnsyncedAsync(CancellationToken ct = default)
        => await db.ProfilePhotos
            .Where(p => !p.FrigateSynced)
            .ToListAsync(ct);

    public async Task AddAsync(ProfilePhoto photo, CancellationToken ct = default)
    {
        db.ProfilePhotos.Add(photo);
        await db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(ProfilePhoto photo, CancellationToken ct = default)
    {
        db.ProfilePhotos.Update(photo);
        await db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var photo = await db.ProfilePhotos.FindAsync([id], ct);
        if (photo is not null)
        {
            db.ProfilePhotos.Remove(photo);
            await db.SaveChangesAsync(ct);
        }
    }
}
