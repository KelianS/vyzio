using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Persistence;

namespace Vyzio.Infrastructure.Persistence.Repositories;

public sealed class NotificationChannelConfigRepository(VyzioDbContext db) : INotificationChannelConfigRepository
{
    public Task<NotificationChannelConfig?> GetByChannelAsync(string channel, CancellationToken ct = default)
        => db.NotificationChannelConfigs
             .FirstOrDefaultAsync(c => c.Channel == channel, ct);

    public async Task UpsertAsync(NotificationChannelConfig config, CancellationToken ct = default)
    {
        var existing = await db.NotificationChannelConfigs
            .FirstOrDefaultAsync(c => c.Channel == config.Channel, ct);

        if (existing is null)
        {
            db.NotificationChannelConfigs.Add(config);
        }
        else
        {
            existing.IsEnabled = config.IsEnabled;
            existing.BotToken = config.BotToken;
            existing.ChatId = config.ChatId;
            existing.MinimumConfidence = config.MinimumConfidence;
            existing.AllowedLabelsJson = config.AllowedLabelsJson;
            existing.ConfiguredAt = config.ConfiguredAt;
            existing.LastTestedAt = config.LastTestedAt;
            existing.LastTestStatus = config.LastTestStatus;
            existing.LastTestError = config.LastTestError;
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task<bool> DeleteByChannelAsync(string channel, CancellationToken ct = default)
    {
        var existing = await db.NotificationChannelConfigs
            .FirstOrDefaultAsync(c => c.Channel == channel, ct);

        if (existing is null)
            return false;

        db.NotificationChannelConfigs.Remove(existing);
        await db.SaveChangesAsync(ct);
        return true;
    }
}
