namespace Vyzio.Core.Entities;

// Tuning parameters for the motion sensitivity loop (ADR-35). Steers on inferences-per-frame
// (detection_fps / camera_fps): Frigate skips inference entirely on frames without motion, so this
// ratio rises with how much the scene moves.
//
// Lives in Core rather than alongside the other runtime settings because the loop itself runs in
// the Application layer, which never references Infrastructure. VyzioRuntimeSettings binds this
// type directly, so the defaults below are the single definition.
public sealed class MotionTuningOptions
{
    public bool Enabled { get; init; } = true;

    public TimeSpan SampleInterval { get; init; } = TimeSpan.FromMinutes(5);

    // Decisions are taken on an aggregate over this window, never on individual samples. Field
    // measurement showed the instantaneous ratio swinging from ~0.4 at rest to ~6.0 under activity
    // on the same camera: sampling it directly would re-level every camera on a day/night cycle.
    public TimeSpan AggregationWindow { get; init; } = TimeSpan.FromHours(24);

    // Samples must span at least this much time before any decision is taken, so the aggregate
    // covers a representative slice of the daily cycle rather than one busy afternoon. This is the
    // price of killing the oscillation: after a restart, the loop stays idle this long.
    public TimeSpan MinimumWindowCoverage { get; init; } = TimeSpan.FromHours(12);

    // Which point of the window's distribution to steer on. The mean would be dragged down by
    // quiet hours until a genuinely noisy camera stopped standing out; an upper percentile answers
    // the question that actually matters — "when this scene is busy, how bad is it".
    public double AggregationPercentile { get; init; } = 0.75;

    // Field measurements: ~1.0 inferences/frame on a stable indoor scene, ~6.0 on an outdoor scene
    // with foliage. The gap between the two bounds is the hysteresis band — a camera sitting inside
    // it is left alone.
    public double RatioDesensitizeAbove { get; init; } = 3.0;
    public double RatioSensitizeBelow { get; init; } = 1.5;

    // Floor on how often a single camera may change level. Secondary to MinimumWindowCoverage,
    // which already paces steps; kept as a hard backstop.
    public TimeSpan MinIntervalBetweenSteps { get; init; } = TimeSpan.FromHours(1);
}
