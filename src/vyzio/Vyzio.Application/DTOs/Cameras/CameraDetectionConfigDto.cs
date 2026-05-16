using Vyzio.Core.Entities;

namespace Vyzio.Application.DTOs.Cameras;

public sealed record CameraDetectionConfigDto(
    string CameraId,
    IReadOnlyList<string> Labels,
    IReadOnlyList<string> AvailableLabels,
    bool ContinuousRecordingEnabled)
{
    public static CameraDetectionConfigDto From(Camera camera) => new(
        camera.Id,
        camera.GetDetectionLabels(),
        KnownDetectionLabels.All,
        camera.ContinuousRecordingEnabled);
}

public sealed record SaveCameraDetectionConfigRequest(
    IReadOnlyList<string> Labels,
    bool ContinuousRecordingEnabled = false);
