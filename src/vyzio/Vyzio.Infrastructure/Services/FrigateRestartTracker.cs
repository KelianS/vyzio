using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

// Bounded window rather than an explicit "restart finished" signal from the apply command itself —
// the shell command returns once Frigate's container restart is *requested*, well before Frigate is
// actually reachable again. The window auto-expires so a broken/invalid config never leaves the Hub
// stuck showing "restarting" forever (ADR-33).
public sealed class FrigateRestartTracker(TimeProvider time) : IFrigateRestartTracker
{
    private static readonly TimeSpan MaxRestartWindow = TimeSpan.FromSeconds(90);

    private DateTimeOffset? _restartStartedAt;

    public bool IsRestarting =>
        _restartStartedAt is { } startedAt && time.GetUtcNow() - startedAt < MaxRestartWindow;

    public void MarkRestarting() => _restartStartedAt = time.GetUtcNow();

    public void MarkRestartComplete() => _restartStartedAt = null;
}
