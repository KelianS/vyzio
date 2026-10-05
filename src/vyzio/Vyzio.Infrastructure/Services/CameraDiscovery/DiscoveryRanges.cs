using System.Net;
using System.Text.RegularExpressions;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Configuration;

namespace Vyzio.Infrastructure.Services.CameraDiscovery;

// The ranges a discovery sweeps: the configured ones, plus the /24 of the private address the dashboard was opened by (ADR-71).
internal static partial class DiscoveryRanges
{
    private const int DashboardPrefix = 24;

    // Addresses one discovery tries at most, named hosts included: a /16 would be 65,000 pings.
    public const int MaxHosts = 1024;

    // What a sweep goes through: the resolved ranges, cut to the addresses the named hosts leave under the cap.
    public static IReadOnlyList<DiscoveryRange> Swept(VyzioRuntimeSettings.DiscoverySettings settings, string? dashboardHost)
        => WithinCap(Resolve(settings.ProbeCidrs, dashboardHost), MaxHosts - settings.ProbeHosts.Count);

    public static IReadOnlyList<DiscoveryRange> Resolve(IReadOnlyList<string> configuredCidrs, string? dashboardHost)
    {
        var ranges = new List<DiscoveryRange>();

        foreach (var cidr in configuredCidrs)
        {
            if (TryParse(cidr, DiscoveryRangeSource.Configured) is { } range && ranges.All(known => known.Cidr != range.Cidr))
            {
                ranges.Add(range);
            }
        }

        if (DashboardSubnet(dashboardHost) is { } subnet && ranges.All(known => known.Cidr != subnet))
        {
            ranges.Add(TryParse(subnet, DiscoveryRangeSource.DashboardAddress)!);
        }

        return ranges;
    }

    // Only a dotted-quad RFC 1918 address: a DNS name, localhost, IPv6 or an overlay address adds nothing.
    public static string? DashboardSubnet(string? host)
    {
        if (string.IsNullOrWhiteSpace(host) || !DottedQuad().IsMatch(host)
            || !IPAddress.TryParse(host, out var address) || !IsPrivate(address))
        {
            return null;
        }

        var mask = uint.MaxValue << (32 - DashboardPrefix);
        return $"{ToIPAddress(ToUInt32(address) & mask)}/{DashboardPrefix}";
    }

    // The ranges as swept under the host cap: the dashboard's /24 first, then cut where the cap falls, so the screen shows only what was tried.
    public static IReadOnlyList<DiscoveryRange> WithinCap(IReadOnlyList<DiscoveryRange> ranges, int cap)
    {
        var swept = new List<DiscoveryRange>();
        var remaining = (long)Math.Max(cap, 0);
        foreach (var range in ranges.OrderBy(range => range.Source == DiscoveryRangeSource.DashboardAddress ? 0 : 1))
        {
            if (remaining == 0)
            {
                break;
            }

            var first = ToUInt32(IPAddress.Parse(range.FirstAddress));
            var count = Math.Min((long)ToUInt32(IPAddress.Parse(range.LastAddress)) - first + 1, remaining);
            swept.Add(range with { LastAddress = ToIPAddress((uint)(first + count - 1)).ToString() });
            remaining -= count;
        }

        return swept;
    }

    // Every address from the range's first to its last.
    public static IEnumerable<string> Hosts(DiscoveryRange range)
    {
        var last = ToUInt32(IPAddress.Parse(range.LastAddress));
        for (var value = (ulong)ToUInt32(IPAddress.Parse(range.FirstAddress)); value <= last; value++)
        {
            yield return ToIPAddress((uint)value).ToString();
        }
    }

    private static DiscoveryRange? TryParse(string cidr, DiscoveryRangeSource source)
    {
        if (HostSpan(cidr) is not { } span || span.EndExclusive <= span.Start)
        {
            return null;
        }

        return new DiscoveryRange(
            $"{ToIPAddress(span.Network)}/{span.Prefix}",
            ToIPAddress(span.Start).ToString(),
            ToIPAddress(span.EndExclusive - 1).ToString(),
            source);
    }

    private static (uint Network, int Prefix, uint Start, uint EndExclusive)? HostSpan(string cidr)
    {
        var parts = cidr.Split('/', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 2 || !DottedQuad().IsMatch(parts[0]) || !IPAddress.TryParse(parts[0], out var address)
            || !int.TryParse(parts[1], out var prefix) || prefix is < 0 or > 32)
        {
            return null;
        }

        var mask = prefix == 0 ? 0u : uint.MaxValue << (32 - prefix);
        var network = ToUInt32(address) & mask;
        var last = (ulong)network + (1UL << (32 - prefix)) - 1;
        return prefix >= 31
            ? (network, prefix, network, (uint)Math.Min(last + 1, uint.MaxValue))
            : (network, prefix, network + 1, (uint)last);
    }

    // RFC 1918 only, which also leaves out loopback, link-local and the 100.64.0.0/10 overlay range.
    private static bool IsPrivate(IPAddress address)
    {
        var bytes = address.GetAddressBytes();
        return bytes[0] == 10
            || (bytes[0] == 172 && bytes[1] is >= 16 and <= 31)
            || (bytes[0] == 192 && bytes[1] == 168);
    }

    private static uint ToUInt32(IPAddress address)
    {
        var bytes = address.GetAddressBytes();
        return ((uint)bytes[0] << 24) | ((uint)bytes[1] << 16) | ((uint)bytes[2] << 8) | bytes[3];
    }

    private static IPAddress ToIPAddress(uint value) =>
        new([(byte)(value >> 24), (byte)(value >> 16), (byte)(value >> 8), (byte)value]);

    [GeneratedRegex(@"^\d{1,3}(\.\d{1,3}){3}$")]
    private static partial Regex DottedQuad();
}
