using Vyzio.Core.Entities;

namespace Vyzio.Application.DTOs.Settings;

// One installation-wide retention window (ADR-39). `Default` is the value Vyzio ships with, sent so
// the interface can offer a way back to it and name it — the same affordance a camera has for
// returning to the installation values, one level up.
public sealed record RetentionSettingDto(int Days, int Default);

public sealed record RecordingSettingsDto(
    RetentionSettingDto Continuous,
    RetentionSettingDto Motion,
    RetentionSettingDto EventClip,
    int MaxDays,
    // Sent so the interface can refuse zero before the input rather than after (ADR-48).
    int MinEventClipDays)
{
    public static RecordingSettingsDto From(RecordingSettings settings) => new(
        new RetentionSettingDto(settings.ContinuousDays, RecordingSettings.DefaultContinuousDays),
        new RetentionSettingDto(settings.MotionDays, RecordingSettings.DefaultMotionDays),
        new RetentionSettingDto(
            RetentionPolicy.ClampEventClipDays(settings.EventClipDays),
            RecordingSettings.DefaultEventClipDays),
        RetentionPolicy.MaxDays,
        RetentionPolicy.MinEventClipDays);
}

public sealed record SaveRecordingSettingsRequest(
    int ContinuousDays,
    int MotionDays,
    int EventClipDays);
