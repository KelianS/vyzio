using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Persistence.Repositories;

public sealed class ScheduleRuleRepository(VyzioDbContext db) : IScheduleRuleRepository
{
    public async Task<IReadOnlyList<ScheduleRule>> GetAllAsync(CancellationToken ct = default)
        => await db.ScheduleRules
            .Include(r => r.Targets)
            .OrderBy(r => r.StartTime)
            .ThenBy(r => r.CreatedAt)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<ScheduleRule>> GetByKindAsync(ScheduleRuleKind kind, CancellationToken ct = default)
        => await db.ScheduleRules
            .Include(r => r.Targets)
            .Where(r => r.Kind == kind)
            .ToListAsync(ct);

    public Task<ScheduleRule?> GetByIdAsync(string id, CancellationToken ct = default)
        => db.ScheduleRules.Include(r => r.Targets).FirstOrDefaultAsync(r => r.Id == id, ct);

    public async Task AddAsync(ScheduleRule rule, CancellationToken ct = default)
    {
        db.ScheduleRules.Add(rule);
        await db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(ScheduleRule rule, CancellationToken ct = default)
    {
        await db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(ScheduleRule rule, CancellationToken ct = default)
    {
        db.ScheduleRules.Remove(rule);
        await db.SaveChangesAsync(ct);
    }
}
