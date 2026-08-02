using Vyzio.Core.Entities;

namespace Vyzio.Application.DTOs.Settings;

// Installation-wide retention (ADR-39). Three durations in days; zero means "keep nothing of this
// kind", which is a legitimate answer and not an absent value.
public sealed record RecordingSettingsDto(
    int ContinuousDays,
    int MotionDays,
    int EventClipDays,
    int MaxDays)
{
    public static RecordingSettingsDto From(RecordingSettings settings) => new(
        settings.ContinuousDays,
        settings.MotionDays,
        settings.EventClipDays,
        RetentionPolicy.MaxDays);
}

public sealed record SaveRecordingSettingsRequest(
    int ContinuousDays,
    int MotionDays,
    int EventClipDays);
