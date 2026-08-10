using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface INotificationRepository
{
    Task<bool> HasSentAsync(string frigateEventId, NotificationChannel channel, CancellationToken ct = default);
    Task<int> CountSentAsync(CancellationToken ct = default);
    Task<DateTimeOffset?> GetLastSentAtAsync(CancellationToken ct = default);
    Task<DateTimeOffset?> GetLastSentAtForAsync(NotificationChannel channel, string camera, string label, CancellationToken ct = default);
    Task AddAsync(Notification notification, CancellationToken ct = default);
    Task<IReadOnlyList<Notification>> GetRecentAsync(NotificationChannel channel, int limit, CancellationToken ct = default);
}
