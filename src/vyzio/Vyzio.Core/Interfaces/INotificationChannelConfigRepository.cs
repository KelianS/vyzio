using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface INotificationChannelConfigRepository
{
    Task<NotificationChannelConfig?> GetByChannelAsync(string channel, CancellationToken ct = default);
    Task UpsertAsync(NotificationChannelConfig config, CancellationToken ct = default);
    Task<bool> DeleteByChannelAsync(string channel, CancellationToken ct = default);
}
