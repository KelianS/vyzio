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

// Retention as this camera sees it (ADR-39). Both halves are sent on purpose: the overrides say
// what the camera decided for itself — null meaning "follow the installation" — and the effective
// days say what actually applies, so the interface can show the value without re-deriving it.
public sealed record CameraRetentionDto(
    int? ContinuousDaysOverride,
    int? MotionDaysOverride,
    int? EventClipDaysOverride,
    int EffectiveContinuousDays,
    int EffectiveMotionDays,
    int EffectiveEventClipDays)
{
    public static CameraRetentionDto From(RecordingSettings installation, Camera camera)
    {
        var policy = RetentionPolicy.Resolve(installation, camera);
        return new CameraRetentionDto(
            camera.ContinuousDaysOverride,
            camera.MotionDaysOverride,
            camera.EventClipDaysOverride,
            policy.ContinuousDays,
            policy.MotionDays,
            policy.EventClipDays);
    }
}

public sealed record CameraDetectionConfigDto(
    string CameraId,
    IReadOnlyList<string> Labels,
    IReadOnlyList<string> AvailableLabels,
    CameraRetentionDto Retention,
    string MotionSensitivity,
    bool MotionSensitivityPinned,
    IReadOnlyList<CameraStreamDto> Streams,
    string? DetectStreamId)
{
    public static CameraDetectionConfigDto From(RecordingSettings installation, Camera camera) => new(
        camera.Id,
        camera.GetDetectionLabels(),
        KnownDetectionLabels.All,
        CameraRetentionDto.From(installation, camera),
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
//
// The three retention values are overrides: null clears them and puts the camera back on the
// installation's values. They are replaced wholesale on every save, like Labels.
public sealed record SaveCameraDetectionConfigRequest(
    IReadOnlyList<string> Labels,
    string? MotionSensitivity = null,
    bool MotionSensitivityPinned = false,
    string? DetectStreamId = null,
    int? ContinuousDaysOverride = null,
    int? MotionDaysOverride = null,
    int? EventClipDaysOverride = null);
