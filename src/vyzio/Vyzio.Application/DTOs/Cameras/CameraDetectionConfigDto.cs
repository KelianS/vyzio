using Vyzio.Core.Common;
using Vyzio.Core.Entities;

namespace Vyzio.Application.DTOs.Cameras;

// One selectable analysis source (ADR-38). Nothing here is a label: the rank and the measured
// resolution are the camera's own facts, and the interface renders them as such. Width/Height are
// null when the protocol reported no exact size — the UI must say so rather than invent one.
public sealed record CameraStreamDto(
    string Id,
    int Ordinal,
    int? Width,
    int? Height,
    int? Fps)
{
    public static CameraStreamDto From(CameraStream stream) => new(
        stream.Id,
        stream.Ordinal,
        stream.Width,
        stream.Height,
        stream.Fps);
}

public sealed record CameraDetectionConfigDto(
    string CameraId,
    IReadOnlyList<string> Labels,
    IReadOnlyList<string> AvailableLabels,
    bool ContinuousRecordingEnabled,
    string MotionSensitivity,
    bool MotionSensitivityPinned,
    IReadOnlyList<CameraStreamDto> Streams,
    string? DetectStreamId)
{
    public static CameraDetectionConfigDto From(Camera camera) => new(
        camera.Id,
        camera.GetDetectionLabels(),
        KnownDetectionLabels.All,
        camera.ContinuousRecordingEnabled,
        SnakeCaseEnum.ToSnakeCase(camera.MotionSensitivity),
        camera.MotionSensitivityPinned,
        [.. camera.Streams.OrderBy(stream => stream.Ordinal).Select(CameraStreamDto.From)],
        // Resolved, not raw: the UI must show which stream is actually in use, which is the main
        // one whenever no choice was made or a stale choice no longer resolves.
        camera.DetectStream?.Id);
}

// MotionSensitivity is only honoured when MotionSensitivityPinned is true — while unpinned the
// tuning loop owns the level and any value sent here would be overwritten on its next pass
// (ADR-35).
public sealed record SaveCameraDetectionConfigRequest(
    IReadOnlyList<string> Labels,
    bool ContinuousRecordingEnabled = false,
    string? MotionSensitivity = null,
    bool MotionSensitivityPinned = false,
    string? DetectStreamId = null);
