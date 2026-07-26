using Vyzio.Core.Entities;

namespace Vyzio.Application.Services;

// Decision half of the motion sensitivity loop (ADR-35), kept free of I/O so the rules are testable
// without a Frigate, a broker or a clock.
//
// Decisions are taken on an aggregate over a long window, never on a single reading: the
// instantaneous ratio swings by an order of magnitude between a quiet night and a busy afternoon on
// the very same camera, so steering on it directly would re-level every camera daily.
//
// Holds the sample window in memory on purpose. Losing it on restart costs a warm-up period, which
// is cheap next to writing a row every five minutes per camera.
public sealed class MotionSensitivityTuner(MotionTuningOptions options)
{
    private readonly Dictionary<string, CameraState> _states = new(StringComparer.Ordinal);

    // `ratio` is inferences per frame for this sample.
    public MotionTuningDecision Evaluate(string cameraId, MotionSensitivity current, double ratio, DateTimeOffset now)
    {
        if (!_states.TryGetValue(cameraId, out var state))
        {
            state = new CameraState();
            _states[cameraId] = state;
        }

        state.Samples.Add(new Sample(now, ratio));
        state.Samples.RemoveAll(s => now - s.At > options.AggregationWindow);

        var coverage = state.Samples.Count > 0 ? now - state.Samples[0].At : TimeSpan.Zero;
        if (coverage < options.MinimumWindowCoverage)
            return new MotionTuningDecision(MotionTuningOutcome.Warmup, state.Samples.Count, null, null);

        var aggregate = Percentile(state.Samples, options.AggregationPercentile);

        var direction = Direction(aggregate);
        if (direction == StepDirection.None)
            return new MotionTuningDecision(MotionTuningOutcome.Settled, state.Samples.Count, aggregate, null);

        var next = Step(current, direction);
        if (next is null)
            return new MotionTuningDecision(MotionTuningOutcome.AtBound, state.Samples.Count, aggregate, null);

        if (state.LastStepAt is { } last && now - last < options.MinIntervalBetweenSteps)
            return new MotionTuningDecision(MotionTuningOutcome.RateLimited, state.Samples.Count, aggregate, null);

        state.LastStepAt = now;
        // The level just changed, so every sample in the window was measured under the old one.
        // Keeping them would push the camera straight through the next level too.
        state.Samples.Clear();

        return new MotionTuningDecision(MotionTuningOutcome.Stepped, 0, aggregate, next);
    }

    // Forgets a camera's window — used when it is pinned, disabled or removed, so a later re-enable
    // characterises the scene afresh rather than from stale history.
    public void Forget(string cameraId) => _states.Remove(cameraId);

    private StepDirection Direction(double aggregate)
    {
        if (aggregate > options.RatioDesensitizeAbove) return StepDirection.Desensitize;
        if (aggregate < options.RatioSensitizeBelow) return StepDirection.Sensitize;
        return StepDirection.None;
    }

    // Nearest-rank percentile. The sample count is small (a few hundred at most) so sorting a copy
    // per pass is cheaper than maintaining an incremental structure.
    private static double Percentile(List<Sample> samples, double percentile)
    {
        var sorted = samples.Select(s => s.Ratio).Order().ToList();
        var rank = (int)Math.Ceiling(percentile * sorted.Count) - 1;
        return sorted[Math.Clamp(rank, 0, sorted.Count - 1)];
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

    private readonly record struct Sample(DateTimeOffset At, double Ratio);

    private sealed class CameraState
    {
        public List<Sample> Samples { get; } = [];
        public DateTimeOffset? LastStepAt { get; set; }
    }
}
