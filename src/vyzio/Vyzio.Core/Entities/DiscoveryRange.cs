namespace Vyzio.Core.Entities;

// Where a swept range comes from, so the discovery screen can say it (ADR-71).
public enum DiscoveryRangeSource
{
    Configured,
    DashboardAddress,
}

// One IPv4 range a discovery sweeps, with the first and last address it tries.
public sealed record DiscoveryRange(string Cidr, string FirstAddress, string LastAddress, DiscoveryRangeSource Source);
