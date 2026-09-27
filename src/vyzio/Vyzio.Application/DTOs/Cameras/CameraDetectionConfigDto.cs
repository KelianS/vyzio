using Vyzio.Core.Common;
using Vyzio.Core.Entities;

namespace Vyzio.Application.DTOs.Cameras;

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
    int MaxDays,
    // Sent so the interface can refuse zero before the input rather than after (ADR-48).
    int MinEventClipDays)
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
                RetentionPolicy.ClampEventClipDays(camera.EventClipDaysOverride),
                inherited.EventClipDays,
                effective.EventClipDays),
            RetentionPolicy.MaxDays,
            RetentionPolicy.MinEventClipDays);
    }
}

public sealed record CameraDetectionConfigDto(
    string CameraId,
    IReadOnlyList<string> Labels,
    IReadOnlyList<string> AvailableLabels,
    CameraRetentionDto Retention,
    string MotionSensitivity,
    bool MotionSensitivityPinned)
{
    public static CameraDetectionConfigDto From(RecordingSettings installation, Camera camera) => new(
        camera.Id,
        camera.GetDetectionLabels(),
        KnownDetectionLabels.All,
        CameraRetentionDto.From(installation, camera),
        SnakeCaseEnum.ToSnakeCase(camera.MotionSensitivity),
        camera.MotionSensitivityPinned);
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
    int? ContinuousDaysOverride = null,
    int? MotionDaysOverride = null,
    int? EventClipDaysOverride = null);
