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

// One retention window as this camera sees it (ADR-39). All three values travel together on
// purpose: `Override` is what the camera decided for itself (null = follow the installation),
// `Installation` is what it falls back to — the interface needs it to name the value a revert
// returns to — and `Effective` is what actually applies. Effective is sent rather than left to the
// client to compute, so `override ?? installation` keeps its single home in Core.
public sealed record RetentionWindowDto(int? Override, int Installation, int Effective);

public sealed record CameraRetentionDto(
    RetentionWindowDto Continuous,
    RetentionWindowDto Motion,
    RetentionWindowDto EventClip,
    int MaxDays)
{
    public static CameraRetentionDto From(RecordingSettings installation, Camera camera)
    {
        var effective = RetentionPolicy.Resolve(installation, camera);
        var inherited = RetentionPolicy.ForInstallation(installation);

        return new CameraRetentionDto(
            new RetentionWindowDto(
                camera.ContinuousDaysOverride, inherited.ContinuousDays, effective.ContinuousDays),
            new RetentionWindowDto(
                camera.MotionDaysOverride, inherited.MotionDays, effective.MotionDays),
            new RetentionWindowDto(
                camera.EventClipDaysOverride, inherited.EventClipDays, effective.EventClipDays),
            RetentionPolicy.MaxDays);
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
