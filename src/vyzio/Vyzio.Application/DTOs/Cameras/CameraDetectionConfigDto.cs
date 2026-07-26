using Vyzio.Core.Common;
using Vyzio.Core.Entities;

namespace Vyzio.Application.DTOs.Cameras;

public sealed record CameraDetectionConfigDto(
    string CameraId,
    IReadOnlyList<string> Labels,
    IReadOnlyList<string> AvailableLabels,
    bool ContinuousRecordingEnabled,
    string MotionSensitivity,
    bool MotionSensitivityPinned)
{
    public static CameraDetectionConfigDto From(Camera camera) => new(
        camera.Id,
        camera.GetDetectionLabels(),
        KnownDetectionLabels.All,
        camera.ContinuousRecordingEnabled,
        SnakeCaseEnum.ToSnakeCase(camera.MotionSensitivity),
        camera.MotionSensitivityPinned);
}

// MotionSensitivity is only honoured when MotionSensitivityPinned is true — while unpinned the
// tuning loop owns the level and any value sent here would be overwritten on its next pass
// (ADR-35).
public sealed record SaveCameraDetectionConfigRequest(
    IReadOnlyList<string> Labels,
    bool ContinuousRecordingEnabled = false,
    string? MotionSensitivity = null,
    bool MotionSensitivityPinned = false);
