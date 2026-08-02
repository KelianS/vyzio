using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Persistence.Repositories;

public sealed class RecordingSettingsRepository(VyzioDbContext db) : IRecordingSettingsRepository
{
    // Reading does not create the row. An installation that has never opened its settings behaves
    // exactly as one that saved the shipped values, and a read stays a read — config generation
    // calls this on every write and has no business touching the database.
    public async Task<RecordingSettings> GetAsync(CancellationToken ct = default)
        => await db.RecordingSettings
                   .AsNoTracking()
                   .FirstOrDefaultAsync(s => s.Id == RecordingSettings.SingletonId, ct)
           ?? RecordingSettings.CreateDefault();

    public async Task SaveAsync(RecordingSettings settings, CancellationToken ct = default)
    {
        var existing = await db.RecordingSettings
            .FirstOrDefaultAsync(s => s.Id == RecordingSettings.SingletonId, ct);

        if (existing is null)
        {
            settings.Id = RecordingSettings.SingletonId;
            settings.UpdatedAt = DateTimeOffset.UtcNow;
            db.RecordingSettings.Add(settings);
        }
        else
        {
            existing.ContinuousDays = settings.ContinuousDays;
            existing.MotionDays = settings.MotionDays;
            existing.EventClipDays = settings.EventClipDays;
            existing.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(ct);
    }
}
