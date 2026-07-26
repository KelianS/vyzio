using Vyzio.Application.Services;
using Vyzio.Core.Entities;

namespace Vyzio.Tests.Services;

public class MotionSensitivityTunerTests
{
    private static readonly DateTimeOffset T0 = new(2026, 7, 26, 0, 0, 0, TimeSpan.Zero);
    private static readonly TimeSpan SampleInterval = TimeSpan.FromMinutes(5);

    private static MotionTuningOptions Options(
        double percentile = 0.75,
        double coverageHours = 12,
        double minStepIntervalHours = 1) => new()
        {
            SampleInterval = SampleInterval,
            AggregationWindow = TimeSpan.FromHours(24),
            MinimumWindowCoverage = TimeSpan.FromHours(coverageHours),
            AggregationPercentile = percentile,
            RatioDesensitizeAbove = 3.0,
            RatioSensitizeBelow = 1.5,
            MinIntervalBetweenSteps = TimeSpan.FromHours(minStepIntervalHours),
        };

    // Feeds samples at SampleInterval apart, returning the last decision and the clock reached.
    private static (MotionTuningDecision Decision, DateTimeOffset Now) Feed(
        MotionSensitivityTuner tuner,
        MotionSensitivity current,
        IEnumerable<double> ratios,
        DateTimeOffset start,
        string cameraId = "cam-1")
    {
        MotionTuningDecision? last = null;
        var now = start;
        foreach (var ratio in ratios)
        {
            last = tuner.Evaluate(cameraId, current, ratio, now);
            now += SampleInterval;
        }
        return (last!, now - SampleInterval);
    }

    // Alternates busy and quiet readings, which is what a real day/night cycle looks like.
    private static IEnumerable<double> DayNight(double busy, double quiet, int count) =>
        Enumerable.Range(0, count).Select(i => i % 2 == 0 ? busy : quiet);

    private static IEnumerable<double> Flat(double ratio, int count) => Enumerable.Repeat(ratio, count);

    // 12 h of coverage at one sample per 5 min.
    private const int SamplesForCoverage = 145;

    [Fact]
    public void No_decision_before_the_window_is_covered()
    {
        var tuner = new MotionSensitivityTuner(Options());

        var (decision, _) = Feed(tuner, MotionSensitivity.High, Flat(9.0, 20), T0);

        Assert.Equal(MotionTuningOutcome.Warmup, decision.Outcome);
        Assert.Null(decision.NextLevel);
        Assert.Null(decision.Aggregate);
    }

    [Fact]
    public void Quiet_night_does_not_undo_a_busy_day()
    {
        // The regression this design exists for: sampled instantaneously, this camera would
        // desensitize by day and re-sensitize by night, forever.
        var tuner = new MotionSensitivityTuner(Options(percentile: 0.75));

        var (decision, _) = Feed(tuner, MotionSensitivity.High, DayNight(6.0, 0.4, SamplesForCoverage), T0);

        Assert.Equal(MotionTuningOutcome.Stepped, decision.Outcome);
        Assert.Equal(MotionSensitivity.Medium, decision.NextLevel);
    }

    [Fact]
    public void Genuinely_quiet_camera_is_left_at_its_level()
    {
        var tuner = new MotionSensitivityTuner(Options());

        var (decision, _) = Feed(tuner, MotionSensitivity.Medium, Flat(2.0, SamplesForCoverage), T0);

        Assert.Equal(MotionTuningOutcome.Settled, decision.Outcome);
        Assert.Null(decision.NextLevel);
    }

    [Fact]
    public void Sustained_low_aggregate_steps_back_up()
    {
        var tuner = new MotionSensitivityTuner(Options());

        var (decision, _) = Feed(tuner, MotionSensitivity.Low, Flat(0.8, SamplesForCoverage), T0);

        Assert.Equal(MotionSensitivity.Medium, decision.NextLevel);
    }

    [Fact]
    public void Low_is_a_hard_floor()
    {
        var tuner = new MotionSensitivityTuner(Options());

        var (decision, _) = Feed(tuner, MotionSensitivity.Low, Flat(12.0, SamplesForCoverage), T0);

        Assert.Equal(MotionTuningOutcome.AtBound, decision.Outcome);
        Assert.Null(decision.NextLevel);
    }

    [Fact]
    public void High_is_a_hard_ceiling()
    {
        var tuner = new MotionSensitivityTuner(Options());

        var (decision, _) = Feed(tuner, MotionSensitivity.High, Flat(0.2, SamplesForCoverage), T0);

        Assert.Equal(MotionTuningOutcome.AtBound, decision.Outcome);
    }

    [Fact]
    public void Stepping_restarts_the_window_so_the_next_level_is_earned_afresh()
    {
        var tuner = new MotionSensitivityTuner(Options());

        var (first, now) = Feed(tuner, MotionSensitivity.High, Flat(9.0, SamplesForCoverage), T0);
        Assert.Equal(MotionSensitivity.Medium, first.NextLevel);

        // Same conditions, but the window was cleared: no second step until it refills.
        var (second, _) = Feed(tuner, MotionSensitivity.Medium, Flat(9.0, 20), now + SampleInterval);
        Assert.Equal(MotionTuningOutcome.Warmup, second.Outcome);
    }

    [Fact]
    public void Rate_limit_blocks_a_step_that_the_window_would_otherwise_allow()
    {
        // Coverage shorter than the step interval, so the window refills while the rate limit
        // is still in force — otherwise MinimumWindowCoverage alone would hide it.
        var tuner = new MotionSensitivityTuner(Options(coverageHours: 1, minStepIntervalHours: 6));

        var samplesForOneHour = 13;
        var (first, now) = Feed(tuner, MotionSensitivity.High, Flat(9.0, samplesForOneHour), T0);
        Assert.Equal(MotionSensitivity.Medium, first.NextLevel);

        var (second, _) = Feed(tuner, MotionSensitivity.Medium, Flat(9.0, samplesForOneHour), now + SampleInterval);
        Assert.Equal(MotionTuningOutcome.RateLimited, second.Outcome);
    }

    [Fact]
    public void Samples_older_than_the_window_are_dropped()
    {
        var tuner = new MotionSensitivityTuner(Options());

        // Starting at Low with busy samples parks the camera on AtBound, so the window is never
        // cleared by a step and this really exercises ageing rather than the post-step reset.
        var (parked, now) = Feed(tuner, MotionSensitivity.Low, Flat(9.0, SamplesForCoverage), T0);
        Assert.Equal(MotionTuningOutcome.AtBound, parked.Outcome);

        // A full window of quiet must age every busy sample out and let the camera come back up.
        var decisions = new List<MotionTuningDecision>();
        var clock = now + SampleInterval;
        for (var i = 0; i < 289; i++)
        {
            decisions.Add(tuner.Evaluate("cam-1", MotionSensitivity.Low, 0.5, clock));
            clock += SampleInterval;
        }

        Assert.Contains(decisions, d => d.NextLevel == MotionSensitivity.Medium);
    }

    [Fact]
    public void Cameras_are_tracked_independently()
    {
        var tuner = new MotionSensitivityTuner(Options());

        Feed(tuner, MotionSensitivity.High, Flat(9.0, SamplesForCoverage), T0, cameraId: "cam-1");
        var (other, _) = Feed(tuner, MotionSensitivity.High, Flat(9.0, 5), T0, cameraId: "cam-2");

        Assert.Equal(MotionTuningOutcome.Warmup, other.Outcome);
    }

    [Fact]
    public void Forget_clears_the_window()
    {
        var tuner = new MotionSensitivityTuner(Options());

        var (_, now) = Feed(tuner, MotionSensitivity.High, Flat(9.0, SamplesForCoverage - 1), T0);
        tuner.Forget("cam-1");

        var decision = tuner.Evaluate("cam-1", MotionSensitivity.High, 9.0, now + SampleInterval);
        Assert.Equal(MotionTuningOutcome.Warmup, decision.Outcome);
    }
}
