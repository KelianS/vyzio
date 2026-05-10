using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Persistence;

namespace Vyzio.Infrastructure.Persistence.Repositories;

public sealed class DetectionEventRepository(VyzioDbContext db) : IDetectionEventRepository
{
    public Task<DetectionEvent?> GetByIdAsync(string id, CancellationToken ct = default)
        => db.DetectionEvents.FirstOrDefaultAsync(evt => evt.Id == id, ct);

    public Task<DetectionEvent?> GetByFrigateEventIdAsync(string frigateEventId, CancellationToken ct = default)
        => db.DetectionEvents.FirstOrDefaultAsync(evt => evt.FrigateEventId == frigateEventId, ct);

    public async Task<IReadOnlyList<DetectionEvent>> GetRecentAsync(int limit, CancellationToken ct = default)
        => await db.DetectionEvents
            .OrderByDescending(evt => evt.OccurredAt)
            .Take(limit)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<DetectionEvent>> GetByProfileAsync(string profileId, int limit, CancellationToken ct = default)
        => await db.DetectionEvents
            .Where(evt => evt.ProfileId == profileId)
            .OrderByDescending(evt => evt.OccurredAt)
            .Take(limit)
            .ToListAsync(ct);

    public async Task AddAsync(DetectionEvent evt, CancellationToken ct = default)
    {
        db.DetectionEvents.Add(evt);
        await db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(DetectionEvent evt, CancellationToken ct = default)
    {
        db.DetectionEvents.Update(evt);
        await db.SaveChangesAsync(ct);
    }
}
