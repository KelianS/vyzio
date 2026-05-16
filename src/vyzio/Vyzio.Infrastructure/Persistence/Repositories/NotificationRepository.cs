using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Persistence.Repositories;

public sealed class NotificationRepository(VyzioDbContext db) : INotificationRepository
{
    public Task<bool> HasSentAsync(string eventId, string channel, CancellationToken ct = default)
        => db.Notifications.AnyAsync(
            notification => notification.EventId == eventId
                && notification.Channel == channel
                && notification.Status == "sent",
            ct);

    public Task<int> CountSentAsync(string channel, CancellationToken ct = default)
        => db.Notifications.CountAsync(
            notification => notification.Channel == channel && notification.Status == "sent",
            ct);

    public async Task<DateTimeOffset?> GetLastSentAtAsync(string channel, CancellationToken ct = default)
        => await db.Notifications
            .Where(notification => notification.Channel == channel && notification.Status == "sent")
            .OrderByDescending(notification => notification.SentAt)
            .Select(notification => (DateTimeOffset?)notification.SentAt)
            .FirstOrDefaultAsync(ct);

    public async Task<DateTimeOffset?> GetLastSentAtForAsync(
        string channel, string camera, string label, CancellationToken ct = default)
        => await (
            from n in db.Notifications
            join e in db.DetectionEvents on n.EventId equals e.Id
            where n.Channel == channel
               && n.Status == "sent"
               && e.Camera == camera
               && e.Label == label
            orderby n.SentAt descending
            select (DateTimeOffset?)n.SentAt
        ).FirstOrDefaultAsync(ct);

    public async Task AddAsync(Notification notification, CancellationToken ct = default)
    {
        db.Notifications.Add(notification);
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<Notification>> GetRecentAsync(string channel, int limit, CancellationToken ct = default)
        => await db.Notifications
            .Where(n => n.Channel == channel)
            .OrderByDescending(n => n.SentAt)
            .Take(limit)
            .ToListAsync(ct);
}