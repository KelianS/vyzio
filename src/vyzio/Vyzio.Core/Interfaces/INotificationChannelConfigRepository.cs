using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface INotificationChannelConfigRepository
{
    Task<NotificationChannelConfig?> GetByChannelAsync(NotificationChannel channel, CancellationToken ct = default);
    Task<IReadOnlyList<NotificationChannelConfig>> GetAllAsync(CancellationToken ct = default);
    Task UpsertAsync(NotificationChannelConfig config, CancellationToken ct = default);
    Task<bool> DeleteByChannelAsync(NotificationChannel channel, CancellationToken ct = default);
}
