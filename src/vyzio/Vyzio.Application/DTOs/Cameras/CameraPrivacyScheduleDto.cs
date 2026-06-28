using Vyzio.Core.Entities;

namespace Vyzio.Application.DTOs.Cameras;

public sealed record CameraPrivacyScheduleDto(
    string Id,
    string CameraId,
    bool Enabled,
    IReadOnlyList<int> DaysOfWeek,
    string StartTime,
    string EndTime,
    DateTimeOffset CreatedAt)
{
    public static CameraPrivacyScheduleDto From(CameraPrivacySchedule s) => new(
        s.Id,
        s.CameraId,
        s.Enabled,
        s.GetDaysOfWeek(),
        s.StartTime,
        s.EndTime,
        s.CreatedAt);
}
