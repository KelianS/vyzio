using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface ICameraPrivacyRepository
{
    Task<IReadOnlyList<CameraPrivacySchedule>> GetSchedulesByCameraAsync(string cameraId, CancellationToken ct = default);
    Task<IReadOnlyList<CameraPrivacySchedule>> GetAllActiveSchedulesAsync(CancellationToken ct = default);
    Task<CameraPrivacySchedule?> GetScheduleByIdAsync(string id, CancellationToken ct = default);
    Task AddScheduleAsync(CameraPrivacySchedule schedule, CancellationToken ct = default);
    Task UpdateScheduleAsync(CameraPrivacySchedule schedule, CancellationToken ct = default);
    Task DeleteScheduleAsync(CameraPrivacySchedule schedule, CancellationToken ct = default);
}
