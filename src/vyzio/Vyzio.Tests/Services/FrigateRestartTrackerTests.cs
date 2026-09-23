using Microsoft.Extensions.Time.Testing;
using Vyzio.Infrastructure.Services;
using Vyzio.Tests.Services.Hosting;

namespace Vyzio.Tests.Services;

public class FrigateRestartTrackerTests
{
    private readonly FakeTimeProvider _time = BackgroundLoop.ClockAt("2026-09-23T10:00:00+00:00");

    [Fact]
    public void IsRestarting_ShouldStayTrue_WhenFrigateIsStillWithinItsRestartWindow()
    {
        var tracker = new FrigateRestartTracker(_time);
        tracker.MarkRestarting();

        _time.Advance(TimeSpan.FromSeconds(89));

        Assert.True(tracker.IsRestarting);
    }

    // A config Frigate cannot start on must not leave the hub showing a restart forever (ADR-33).
    [Fact]
    public void IsRestarting_ShouldTurnFalse_WhenTheRestartWindowHasElapsed()
    {
        var tracker = new FrigateRestartTracker(_time);
        tracker.MarkRestarting();

        _time.Advance(TimeSpan.FromSeconds(90));

        Assert.False(tracker.IsRestarting);
    }

    [Fact]
    public void IsRestarting_ShouldTurnFalse_WhenFrigateAnswersBeforeTheWindowEnds()
    {
        var tracker = new FrigateRestartTracker(_time);
        tracker.MarkRestarting();

        tracker.MarkRestartComplete();

        Assert.False(tracker.IsRestarting);
    }
}
