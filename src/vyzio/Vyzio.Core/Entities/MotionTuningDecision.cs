namespace Vyzio.Core.Entities;

// Why the tuning loop did or did not move a camera (ADR-35). Structured rather than a log string
// because the same reason has to reach the user in product wording — no opaque state (principle #4).
public enum MotionTuningOutcome
{
    // Not enough history yet to characterise the scene.
    Warmup,

    // Aggregate sits inside the hysteresis band: the current level is appropriate.
    Settled,

    // The aggregate calls for a step, but the camera is already at the most or least sensitive level.
    AtBound,

    // The aggregate calls for a step, but the camera moved too recently.
    RateLimited,

    Stepped,
}

// Aggregate is null while in Warmup — there is deliberately no value to report yet.
public sealed record MotionTuningDecision(
    MotionTuningOutcome Outcome,
    int SampleCount,
    double? Aggregate,
    MotionSensitivity? NextLevel);
