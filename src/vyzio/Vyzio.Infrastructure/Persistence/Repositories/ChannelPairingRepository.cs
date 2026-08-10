using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Persistence.Repositories;

public sealed class ChannelPairingRepository(VyzioDbContext db) : IChannelPairingRepository
{
    public Task<ChannelPairing?> GetByChannelAsync(NotificationChannel channel, CancellationToken ct = default)
        => db.ChannelPairings.FirstOrDefaultAsync(pairing => pairing.Channel == channel, ct);

    public async Task UpsertAsync(ChannelPairing pairing, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(pairing);

        var existing = await db.ChannelPairings
            .FirstOrDefaultAsync(candidate => candidate.Channel == pairing.Channel, ct);

        if (existing is null)
            db.ChannelPairings.Add(pairing);
        else if (!ReferenceEquals(existing, pairing))
        {
            pairing.Id = existing.Id; // the channel identifies the row, the key only stores it
            db.Entry(existing).CurrentValues.SetValues(pairing);
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task<bool> DeleteByChannelAsync(NotificationChannel channel, CancellationToken ct = default)
    {
        var existing = await db.ChannelPairings
            .FirstOrDefaultAsync(pairing => pairing.Channel == channel, ct);

        if (existing is null) return false;

        db.ChannelPairings.Remove(existing);
        await db.SaveChangesAsync(ct);
        return true;
    }
}
