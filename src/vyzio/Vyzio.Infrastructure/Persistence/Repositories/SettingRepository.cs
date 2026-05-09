using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Persistence;

namespace Vyzio.Infrastructure.Persistence.Repositories;

public sealed class SettingRepository(VyzioDbContext db) : ISettingRepository
{
    public Task<Setting?> GetAsync(string key, CancellationToken ct = default)
        => db.Settings.FirstOrDefaultAsync(s => s.Key == key, ct);

    public async Task<IReadOnlyList<Setting>> GetAllAsync(CancellationToken ct = default)
        => await db.Settings.OrderBy(s => s.Key).ToListAsync(ct);

    public async Task SetAsync(Setting setting, CancellationToken ct = default)
    {
        var existing = await db.Settings.FindAsync([setting.Key], ct);
        if (existing is null)
            db.Settings.Add(setting);
        else
            existing.Value = setting.Value;

        await db.SaveChangesAsync(ct);
    }
}
