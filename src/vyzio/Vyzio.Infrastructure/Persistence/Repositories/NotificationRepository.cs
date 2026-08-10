using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Persistence.Repositories;

public sealed class NotificationRepository(VyzioDbContext db) : INotificationRepository
{
    public Task<bool> HasSentAsync(string frigateEventId, NotificationChannel channel, CancellationToken ct = default)
        => db.Notifications.AnyAsync(
            notification => notification.FrigateEventId == frigateEventId
                && notification.Channel == channel
                && notification.Status == NotificationStatus.Sent,
            ct);

    // Counted across channels: the hub reports what the household was told, not by which route.
    public Task<int> CountSentAsync(CancellationToken ct = default)
        => db.Notifications.CountAsync(notification => notification.Status == NotificationStatus.Sent, ct);

    public async Task<DateTimeOffset?> GetLastSentAtAsync(CancellationToken ct = default)
        => await db.Notifications
            .Where(notification => notification.Status == NotificationStatus.Sent)
            .OrderByDescending(notification => notification.SentAt)
            .Select(notification => (DateTimeOffset?)notification.SentAt)
            .FirstOrDefaultAsync(ct);

    public async Task<DateTimeOffset?> GetLastSentAtForAsync(
        NotificationChannel channel, string camera, string label, CancellationToken ct = default)
        => await db.Notifications
            .Where(n => n.Channel == channel
                     && n.Status == NotificationStatus.Sent
                     && n.Camera == camera
                     && n.Label == label)
            .OrderByDescending(n => n.SentAt)
            .Select(n => (DateTimeOffset?)n.SentAt)
            .FirstOrDefaultAsync(ct);

    public async Task AddAsync(Notification notification, CancellationToken ct = default)
    {
        db.Notifications.Add(notification);
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<Notification>> GetRecentAsync(
        NotificationChannel channel, int limit, CancellationToken ct = default)
        => await db.Notifications
            .Where(n => n.Channel == channel)
            .OrderByDescending(n => n.SentAt)
            .Take(limit)
            .ToListAsync(ct);
}
