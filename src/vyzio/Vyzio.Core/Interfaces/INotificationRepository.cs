using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface INotificationRepository
{
    Task<bool> HasSentAsync(string frigateEventId, string channel, CancellationToken ct = default);
    Task<int> CountSentAsync(string channel, CancellationToken ct = default);
    Task<DateTimeOffset?> GetLastSentAtAsync(string channel, CancellationToken ct = default);
    Task<DateTimeOffset?> GetLastSentAtForAsync(string channel, string camera, string label, CancellationToken ct = default);
    Task AddAsync(Notification notification, CancellationToken ct = default);
    Task<IReadOnlyList<Notification>> GetRecentAsync(string channel, int limit, CancellationToken ct = default);
}