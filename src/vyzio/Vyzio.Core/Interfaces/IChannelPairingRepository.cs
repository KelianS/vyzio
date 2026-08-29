using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IChannelPairingRepository
{
    Task<ChannelPairing?> GetByChannelAsync(NotificationChannel channel, CancellationToken ct = default);

    Task UpsertAsync(ChannelPairing pairing, CancellationToken ct = default);

    Task<bool> DeleteByChannelAsync(NotificationChannel channel, CancellationToken ct = default);
}
