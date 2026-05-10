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

    public async Task AddAsync(Notification notification, CancellationToken ct = default)
    {
        db.Notifications.Add(notification);
        await db.SaveChangesAsync(ct);
    }
}