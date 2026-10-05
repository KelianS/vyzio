using System.Net;
using System.Text.RegularExpressions;
using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.Services.CameraDiscovery;

// The ranges a discovery sweeps: the configured ones, plus the /24 of the private address the dashboard was opened by (#251).
internal static partial class DiscoveryRanges
{
    private const int DashboardPrefix = 24;

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

    // Every host address of the range, network and broadcast left out below a /31.
    public static IEnumerable<string> Hosts(DiscoveryRange range)
    {
        var span = HostSpan(range.Cidr)!.Value;
        for (var value = span.Start; value < span.EndExclusive; value++)
        {
            yield return ToIPAddress(value).ToString();
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
