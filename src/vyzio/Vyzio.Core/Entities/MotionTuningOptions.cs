namespace Vyzio.Core.Entities;

// Tuning parameters for the motion sensitivity loop (ADR-35). Steers on inferences-per-frame
// (detection_fps / camera_fps): Frigate runs one inference per motion region, so a high ratio means
// the scene is generating spurious motion rather than that something is actually happening.
//
// Lives in Core rather than alongside the other runtime settings because the loop itself runs in
// the Application layer, which never references Infrastructure. VyzioRuntimeSettings binds this
// type directly, so the defaults below are the single definition.
public sealed class MotionTuningOptions
{
    public bool Enabled { get; init; } = true;

    public TimeSpan SampleInterval { get; init; } = TimeSpan.FromMinutes(5);

    // Field measurements: ~1.2 inferences/frame on a stable indoor scene, ~6.0 on an outdoor scene
    // with foliage. The gap between the two bounds is the hysteresis band — a camera sitting inside
    // it is left alone, which is what stops the loop oscillating between levels.
    public double RatioDesensitizeAbove { get; init; } = 3.0;
    public double RatioSensitizeBelow { get; init; } = 1.5;

    // Consecutive out-of-band samples required before stepping, so a one-off burst of real activity
    // (a delivery, a party) never re-levels a camera on its own.
    public int ConsecutiveSamplesToStep { get; init; } = 3;

    // Floor on how often a single camera may change level, independent of the sample counter.
    public TimeSpan MinIntervalBetweenSteps { get; init; } = TimeSpan.FromHours(1);
}
