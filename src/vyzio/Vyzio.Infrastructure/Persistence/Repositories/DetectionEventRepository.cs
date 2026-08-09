using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Persistence;

namespace Vyzio.Infrastructure.Persistence.Repositories;

public sealed class DetectionEventRepository(VyzioDbContext db) : IDetectionEventRepository
{
    public Task<DetectionEvent?> GetByFrigateEventIdAsync(string frigateEventId, CancellationToken ct = default)
        => db.DetectionEvents.FirstOrDefaultAsync(evt => evt.FrigateEventId == frigateEventId, ct);

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
