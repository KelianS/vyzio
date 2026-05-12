using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface ICameraDiscoveryService
{
    Task<IReadOnlyList<CameraDiscoveryCandidate>> DiscoverAsync(CancellationToken ct = default);
}