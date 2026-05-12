using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface INotificationRepository
{
    Task<bool> HasSentAsync(string eventId, string channel, CancellationToken ct = default);
    Task<int> CountSentAsync(string channel, CancellationToken ct = default);
    Task<DateTimeOffset?> GetLastSentAtAsync(string channel, CancellationToken ct = default);
    Task AddAsync(Notification notification, CancellationToken ct = default);
}