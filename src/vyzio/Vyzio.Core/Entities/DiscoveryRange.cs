namespace Vyzio.Core.Entities;

// Where a swept range comes from, so the discovery screen can say it (#251).
public enum DiscoveryRangeSource
{
    Configured,
    DashboardAddress,
}

// One IPv4 range a discovery swept, with the first and last address it tries.
public sealed record DiscoveryRange(string Cidr, string FirstAddress, string LastAddress, DiscoveryRangeSource Source);

// What a discovery returns: the ranges it swept (none for a single target) and what it found.
public sealed record CameraDiscoveryResult(IReadOnlyList<DiscoveryRange> Ranges, IReadOnlyList<CameraDiscoveryCandidate> Candidates);
