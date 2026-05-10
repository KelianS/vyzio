using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Persistence;

namespace Vyzio.Infrastructure.Persistence.Repositories;

public sealed class ObservedEventRepository(VyzioDbContext db) : IObservedEventRepository
{
    public Task<ObservedEvent?> GetByIdAsync(string id, CancellationToken ct = default)
        => db.ObservedEvents.FirstOrDefaultAsync(evt => evt.Id == id, ct);

    public Task<ObservedEvent?> GetByFrigateEventIdAsync(string frigateEventId, CancellationToken ct = default)
        => db.ObservedEvents.FirstOrDefaultAsync(evt => evt.FrigateEventId == frigateEventId, ct);

    public async Task<IReadOnlyList<ObservedEvent>> GetRecentAsync(int limit, CancellationToken ct = default)
        => await db.ObservedEvents
            .OrderByDescending(evt => evt.OccurredAt)
            .Take(limit)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<ObservedEvent>> GetByProfileAsync(string profileId, int limit, CancellationToken ct = default)
        => await db.ObservedEvents
            .Where(evt => evt.ProfileId == profileId)
            .OrderByDescending(evt => evt.OccurredAt)
            .Take(limit)
            .ToListAsync(ct);

    public async Task AddAsync(ObservedEvent evt, CancellationToken ct = default)
    {
        db.ObservedEvents.Add(evt);
        await db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(ObservedEvent evt, CancellationToken ct = default)
    {
        db.ObservedEvents.Update(evt);
        await db.SaveChangesAsync(ct);
    }
}