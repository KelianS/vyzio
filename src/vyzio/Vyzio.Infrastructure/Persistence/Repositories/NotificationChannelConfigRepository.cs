using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Persistence.Repositories;

public sealed class NotificationChannelConfigRepository(VyzioDbContext db) : INotificationChannelConfigRepository
{
    public Task<NotificationChannelConfig?> GetByChannelAsync(NotificationChannel channel, CancellationToken ct = default)
        => db.NotificationChannelConfigs
             .FirstOrDefaultAsync(c => c.Channel == channel, ct);

    public async Task<IReadOnlyList<NotificationChannelConfig>> GetAllAsync(CancellationToken ct = default)
        => await db.NotificationChannelConfigs.ToListAsync(ct);

    public async Task UpsertAsync(NotificationChannelConfig config, CancellationToken ct = default)
    {
        var existing = await db.NotificationChannelConfigs
            .FirstOrDefaultAsync(c => c.Channel == config.Channel, ct);

        if (existing is null)
            db.NotificationChannelConfigs.Add(config);
        else if (!ReferenceEquals(existing, config))
        {
            config.Id = existing.Id; // the channel identifies the row, the key only stores it
            db.Entry(existing).CurrentValues.SetValues(config);
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task<bool> DeleteByChannelAsync(NotificationChannel channel, CancellationToken ct = default)
    {
        var existing = await db.NotificationChannelConfigs
            .FirstOrDefaultAsync(c => c.Channel == channel, ct);

        if (existing is null)
            return false;

        db.NotificationChannelConfigs.Remove(existing);
        await db.SaveChangesAsync(ct);
        return true;
    }
}
