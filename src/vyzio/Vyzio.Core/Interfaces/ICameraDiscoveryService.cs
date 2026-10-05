using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface ICameraDiscoveryService
{
    // dashboardHost: the host the user opened the dashboard by; its private /24 joins the swept ranges (ADR-71).
    Task<IReadOnlyList<CameraDiscoveryCandidate>> DiscoverAsync(CameraDiscoveryTarget? target = null, string? dashboardHost = null, CancellationToken ct = default);

    // The ranges a full discovery would sweep for this dashboard host, computed without probing anything.
    IReadOnlyList<DiscoveryRange> RangesToSweep(string? dashboardHost);
}
