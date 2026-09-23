using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Monitoring;

// The one reading of Frigate's three states (ADR-33), shared by the hub and the readiness probe.
public sealed class FrigateStatusReader(IFrigateStatsProvider statsProvider, IFrigateRestartTracker restartTracker)
{
    public async Task<(FrigateStatus Status, FrigateStats? Stats)> ReadAsync(CancellationToken ct = default)
    {
        var stats = await statsProvider.TryGetStatsAsync(ct);
        if (stats is null)
            return (restartTracker.IsRestarting ? FrigateStatus.Restarting : FrigateStatus.Unavailable, null);

        restartTracker.MarkRestartComplete();
        return (FrigateStatus.Active, stats);
    }
}
