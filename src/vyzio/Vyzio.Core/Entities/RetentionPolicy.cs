namespace Vyzio.Core.Entities;

// What a given camera actually keeps, once its overrides are laid over the installation values
// (ADR-39). This is the single place where `override ?? global` is resolved: config generation and
// the API boundary both go through it, so neither can drift from the other.
public readonly record struct RetentionPolicy(int ContinuousDays, int MotionDays, int EventClipDays)
{
    public static RetentionPolicy ForInstallation(RecordingSettings installation) => new(
        installation.ContinuousDays,
        installation.MotionDays,
        ClampEventClipDays(installation.EventClipDays));

    public static RetentionPolicy Resolve(RecordingSettings installation, Camera camera) => new(
        camera.ContinuousDaysOverride ?? installation.ContinuousDays,
        camera.MotionDaysOverride ?? installation.MotionDays,
        ClampEventClipDays(camera.EventClipDaysOverride ?? installation.EventClipDays));

    // Days are user input on both sides of the boundary. Frigate accepts any non-negative number;
    // the upper bound is Vyzio's, so a typo cannot silently commit the disk to years of footage.
    public const int MaxDays = 365;

    // Event clips carry the history (ADR-48): zero there would not shorten it, it would abolish it.
    public const int MinEventClipDays = 1;

    public static int ClampDays(int days) => Math.Clamp(days, 0, MaxDays);

    public static int? ClampDays(int? days) => days is null ? null : ClampDays(days.Value);

    public static int ClampEventClipDays(int days) => Math.Clamp(days, MinEventClipDays, MaxDays);

    public static int? ClampEventClipDays(int? days)
        => days is null ? null : ClampEventClipDays(days.Value);
}
