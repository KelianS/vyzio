using Vyzio.Application.DTOs.Notifications;

namespace Vyzio.Application.DTOs.Cameras;

/// <param name="ScheduleNextChange">When the privacy ranges next start or stop, or null when there is none: the sheet's « Jusqu'à » option (PRIV-22).</param>
public sealed record CamerasCutDto(HouseMomentDto? ScheduleNextChange);
