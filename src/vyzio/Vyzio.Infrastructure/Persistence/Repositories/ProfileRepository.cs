using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Persistence;

namespace Vyzio.Infrastructure.Persistence.Repositories;

public sealed class ProfileRepository(VyzioDbContext db) : IProfileRepository
{
    public Task<Profile?> GetByIdAsync(string id, CancellationToken ct = default)
        => db.Profiles.FirstOrDefaultAsync(p => p.Id == id, ct);

    public async Task<IReadOnlyList<Profile>> GetAllAsync(CancellationToken ct = default)
        => await db.Profiles.OrderBy(p => p.Name).ToListAsync(ct);

    public async Task AddAsync(Profile profile, CancellationToken ct = default)
    {
        db.Profiles.Add(profile);
        await db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(Profile profile, CancellationToken ct = default)
    {
        db.Profiles.Update(profile);
        await db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        await db.Profiles.Where(p => p.Id == id).ExecuteDeleteAsync(ct);
    }
}
