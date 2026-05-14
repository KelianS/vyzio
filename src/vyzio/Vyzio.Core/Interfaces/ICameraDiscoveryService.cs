using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface ICameraDiscoveryService
{
    Task<IReadOnlyList<CameraDiscoveryCandidate>> DiscoverAsync(CameraDiscoveryTarget? target = null, CancellationToken ct = default);
}