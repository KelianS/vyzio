using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Persistence.Repositories;

public sealed class NotificationSilenceRepository(VyzioDbContext db) : INotificationSilenceRepository
{
    public async Task<NotificationSilence?> GetAsync(CancellationToken ct = default)
        => await db.NotificationSilences
                   .AsNoTracking()
                   .FirstOrDefaultAsync(s => s.Id == NotificationSilence.SingletonId, ct);

    public async Task SaveAsync(NotificationSilence silence, CancellationToken ct = default)
    {
        var existing = await db.NotificationSilences
            .FirstOrDefaultAsync(s => s.Id == NotificationSilence.SingletonId, ct);

        if (existing is null)
        {
            silence.Id = NotificationSilence.SingletonId;
            db.NotificationSilences.Add(silence);
        }
        else
        {
            existing.StartedAt = silence.StartedAt;
            existing.Until = silence.Until;
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task ClearAsync(CancellationToken ct = default)
        => await db.NotificationSilences
                   .Where(s => s.Id == NotificationSilence.SingletonId)
                   .ExecuteDeleteAsync(ct);
}
