using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Persistence;

namespace Vyzio.Infrastructure.Persistence.Repositories;

public sealed class CameraPrivacyRepository(VyzioDbContext db) : ICameraPrivacyRepository
{
    public async Task<IReadOnlyList<CameraPrivacySchedule>> GetSchedulesByCameraAsync(string cameraId, CancellationToken ct = default)
        => await db.CameraPrivacySchedules
            .Where(s => s.CameraId == cameraId)
            .OrderBy(s => s.StartTime)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<CameraPrivacySchedule>> GetAllActiveSchedulesAsync(CancellationToken ct = default)
        => await db.CameraPrivacySchedules
            .Where(s => s.Enabled)
            .ToListAsync(ct);

    public Task<CameraPrivacySchedule?> GetScheduleByIdAsync(string id, CancellationToken ct = default)
        => db.CameraPrivacySchedules.FirstOrDefaultAsync(s => s.Id == id, ct);

    public async Task AddScheduleAsync(CameraPrivacySchedule schedule, CancellationToken ct = default)
    {
        db.CameraPrivacySchedules.Add(schedule);
        await db.SaveChangesAsync(ct);
    }

    public async Task UpdateScheduleAsync(CameraPrivacySchedule schedule, CancellationToken ct = default)
    {
        db.CameraPrivacySchedules.Update(schedule);
        await db.SaveChangesAsync(ct);
    }

    public async Task DeleteScheduleAsync(CameraPrivacySchedule schedule, CancellationToken ct = default)
    {
        db.CameraPrivacySchedules.Remove(schedule);
        await db.SaveChangesAsync(ct);
    }
}
