using Vyzio.Application.Services;
using Vyzio.Core.Entities;

namespace Vyzio.Tests.Services;

public class MotionSensitivityTunerTests
{
    private static readonly DateTimeOffset T0 = new(2026, 7, 26, 12, 0, 0, TimeSpan.Zero);

    private static MotionTuningOptions Options(int consecutive = 3, double minutesBetweenSteps = 60) => new()
    {
        RatioDesensitizeAbove = 3.0,
        RatioSensitizeBelow = 1.5,
        ConsecutiveSamplesToStep = consecutive,
        MinIntervalBetweenSteps = TimeSpan.FromMinutes(minutesBetweenSteps),
    };

    // Feeds `count` samples at the same ratio and returns the last decision.
    private static MotionSensitivity? Feed(
        MotionSensitivityTuner tuner,
        MotionSensitivity current,
        double ratio,
        int count,
        DateTimeOffset? at = null)
    {
        MotionSensitivity? last = null;
        for (var i = 0; i < count; i++)
            last = tuner.Evaluate("cam-1", current, ratio, at ?? T0);
        return last;
    }

    [Fact]
    public void Ratio_inside_hysteresis_band_never_steps()
    {
        var tuner = new MotionSensitivityTuner(Options());

        var decision = Feed(tuner, MotionSensitivity.Medium, ratio: 2.0, count: 20);

        Assert.Null(decision);
    }

    [Fact]
    public void Sustained_high_ratio_steps_down_one_level_only_after_enough_samples()
    {
        var tuner = new MotionSensitivityTuner(Options(consecutive: 3));

        Assert.Null(Feed(tuner, MotionSensitivity.High, ratio: 6.0, count: 2));
        Assert.Equal(MotionSensitivity.Medium, tuner.Evaluate("cam-1", MotionSensitivity.High, 6.0, T0));
    }

    [Fact]
    public void Sustained_low_ratio_steps_back_up()
    {
        var tuner = new MotionSensitivityTuner(Options(consecutive: 3));

        Assert.Equal(MotionSensitivity.Medium, Feed(tuner, MotionSensitivity.Low, ratio: 1.0, count: 3));
    }

    [Fact]
    public void Direction_reversal_resets_the_sample_count()
    {
        var tuner = new MotionSensitivityTuner(Options(consecutive: 3));

        Feed(tuner, MotionSensitivity.Medium, ratio: 6.0, count: 2);
        // One sample the other way wipes the pending desensitize streak...
        tuner.Evaluate("cam-1", MotionSensitivity.Medium, 1.0, T0);
        // ...so the next high sample is only the first of a new streak, not the third.
        Assert.Null(tuner.Evaluate("cam-1", MotionSensitivity.Medium, 6.0, T0));
    }

    [Fact]
    public void Low_is_a_hard_floor()
    {
        var tuner = new MotionSensitivityTuner(Options(consecutive: 3));

        Assert.Null(Feed(tuner, MotionSensitivity.Low, ratio: 12.0, count: 20));
    }

    [Fact]
    public void High_is_a_hard_ceiling()
    {
        var tuner = new MotionSensitivityTuner(Options(consecutive: 3));

        Assert.Null(Feed(tuner, MotionSensitivity.High, ratio: 0.5, count: 20));
    }

    [Fact]
    public void Second_step_is_refused_before_the_minimum_interval_elapses()
    {
        var tuner = new MotionSensitivityTuner(Options(consecutive: 3, minutesBetweenSteps: 60));

        Assert.Equal(MotionSensitivity.Medium, Feed(tuner, MotionSensitivity.High, 6.0, 3));

        // Same trend continues and the streak reconfirms, but not enough time has passed to move.
        Assert.Null(Feed(tuner, MotionSensitivity.Medium, 6.0, 3, T0.AddMinutes(30)));

        // Once the interval has elapsed the already-confirmed streak steps on the very next
        // sample — the trend does not have to be re-proven from scratch.
        Assert.Equal(
            MotionSensitivity.Low,
            tuner.Evaluate("cam-1", MotionSensitivity.Medium, 6.0, T0.AddMinutes(90)));
    }

    [Fact]
    public void Forget_clears_the_pending_streak()
    {
        var tuner = new MotionSensitivityTuner(Options(consecutive: 3));

        Feed(tuner, MotionSensitivity.High, ratio: 6.0, count: 2);
        tuner.Forget("cam-1");

        Assert.Null(tuner.Evaluate("cam-1", MotionSensitivity.High, 6.0, T0));
    }

    [Fact]
    public void Cameras_are_tracked_independently()
    {
        var tuner = new MotionSensitivityTuner(Options(consecutive: 2));

        tuner.Evaluate("cam-1", MotionSensitivity.High, 6.0, T0);
        // cam-2's first sample must not inherit cam-1's streak.
        Assert.Null(tuner.Evaluate("cam-2", MotionSensitivity.High, 6.0, T0));
        Assert.Equal(MotionSensitivity.Medium, tuner.Evaluate("cam-1", MotionSensitivity.High, 6.0, T0));
    }
}
