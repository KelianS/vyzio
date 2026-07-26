using Vyzio.Core.Entities;

namespace Vyzio.Application.Services;

// Decision half of the motion sensitivity loop (ADR-35), kept free of I/O so the stepping rules —
// hysteresis, confirmation over consecutive samples, rate limiting — are testable without a
// Frigate, a broker or a clock.
//
// Holds per-camera counters in memory on purpose: losing them on restart only costs a few samples
// of re-observation, which is not worth a database round-trip on every tick.
public sealed class MotionSensitivityTuner(MotionTuningOptions options)
{
    private readonly Dictionary<string, CameraState> _states = new(StringComparer.Ordinal);

    // Returns the level to move to, or null to stay put. `ratio` is inferences per frame.
    public MotionSensitivity? Evaluate(string cameraId, MotionSensitivity current, double ratio, DateTimeOffset now)
    {
        if (!_states.TryGetValue(cameraId, out var state))
        {
            state = new CameraState();
            _states[cameraId] = state;
        }

        var direction = Direction(ratio);

        // Any sample that lands inside the hysteresis band, or that reverses the pending direction,
        // resets the count — only a sustained trend in one direction may step the level.
        if (direction == StepDirection.None || direction != state.PendingDirection)
        {
            state.PendingDirection = direction;
            state.ConsecutiveSamples = direction == StepDirection.None ? 0 : 1;
            return null;
        }

        state.ConsecutiveSamples++;
        if (state.ConsecutiveSamples < options.ConsecutiveSamplesToStep)
            return null;

        var next = Step(current, direction);
        if (next is null)
        {
            // Already at the bound in that direction: stop counting rather than accumulate forever.
            state.ConsecutiveSamples = 0;
            return null;
        }

        if (state.LastStepAt is { } last && now - last < options.MinIntervalBetweenSteps)
            return null;

        state.LastStepAt = now;
        state.ConsecutiveSamples = 0;
        state.PendingDirection = StepDirection.None;
        return next;
    }

    // Forgets a camera's accumulated state — used when it is pinned, disabled or removed, so a
    // later re-enable starts from a clean slate rather than an aged count.
    public void Forget(string cameraId) => _states.Remove(cameraId);

    private StepDirection Direction(double ratio)
    {
        if (ratio > options.RatioDesensitizeAbove) return StepDirection.Desensitize;
        if (ratio < options.RatioSensitizeBelow) return StepDirection.Sensitize;
        return StepDirection.None;
    }

    // One level at a time, never past the bounds. Low is a hard floor: the loop chases load, never
    // detection quality, so it must not be able to blind a camera (ADR-35).
    private static MotionSensitivity? Step(MotionSensitivity current, StepDirection direction) =>
        (current, direction) switch
        {
            (MotionSensitivity.High, StepDirection.Desensitize) => MotionSensitivity.Medium,
            (MotionSensitivity.Medium, StepDirection.Desensitize) => MotionSensitivity.Low,
            (MotionSensitivity.Low, StepDirection.Sensitize) => MotionSensitivity.Medium,
            (MotionSensitivity.Medium, StepDirection.Sensitize) => MotionSensitivity.High,
            _ => null,
        };

    private enum StepDirection
    {
        None,
        Desensitize,
        Sensitize,
    }

    private sealed class CameraState
    {
        public StepDirection PendingDirection { get; set; } = StepDirection.None;
        public int ConsecutiveSamples { get; set; }
        public DateTimeOffset? LastStepAt { get; set; }
    }
}
