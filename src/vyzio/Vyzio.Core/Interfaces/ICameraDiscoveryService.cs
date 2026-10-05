using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface ICameraDiscoveryService
{
    // dashboardHost: the host the user opened the dashboard by; its private /24 joins the swept ranges (ADR-71).
    Task<CameraDiscoveryResult> DiscoverAsync(CameraDiscoveryTarget? target = null, string? dashboardHost = null, CancellationToken ct = default);
}
