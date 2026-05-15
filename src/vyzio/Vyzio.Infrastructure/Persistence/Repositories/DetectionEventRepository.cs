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

    public async Task<(IReadOnlyList<DetectionEvent> Items, int Total)> GetPagedAsync(
        DetectionHistoryQuery query, CancellationToken ct = default)
    {
        var q = db.DetectionEvents.AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Camera))
            q = q.Where(e => e.Camera == query.Camera);

        if (!string.IsNullOrWhiteSpace(query.Label))
            q = q.Where(e => e.Label == query.Label);

        if (!string.IsNullOrWhiteSpace(query.ProfileId))
            q = q.Where(e => e.ProfileId == query.ProfileId);

        if (query.From.HasValue)
            q = q.Where(e => e.OccurredAt >= query.From.Value);

        if (query.To.HasValue)
            q = q.Where(e => e.OccurredAt <= query.To.Value);

        var total = await q.CountAsync(ct);

        var limit = Math.Clamp(query.Limit, 1, 100);
        var offset = (Math.Max(query.Page, 1) - 1) * limit;

        var items = await q
            .OrderByDescending(e => e.OccurredAt)
            .Skip(offset)
            .Take(limit)
            .ToListAsync(ct);

        return (items, total);
    }

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

    public async Task UpdateIdentityAsync(string id, string? identity, string? profileId, CancellationToken ct = default)
    {
        await db.DetectionEvents
            .Where(e => e.Id == id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(e => e.Identity, identity)
                .SetProperty(e => e.ProfileId, profileId),
                ct);
    }
}
