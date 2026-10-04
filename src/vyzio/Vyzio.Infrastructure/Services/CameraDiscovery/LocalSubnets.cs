using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace Vyzio.Infrastructure.Services.CameraDiscovery;

// One IPv4 address of a host interface, the facts LocalSubnets needs and nothing else.
internal sealed record InterfaceAddress(string InterfaceName, NetworkInterfaceType Type, bool IsUp, IPAddress Address, int PrefixLength);

// The subnets discovery sweeps by default: those of the host's own network interfaces (ADR-32).
internal static class LocalSubnets
{
    private const int WidestSweptPrefix = 24;

    // Container, virtual machine and VPN interfaces: their subnets never hold a home camera.
    private static readonly string[] VirtualInterfacePrefixes = ["docker", "br-", "veth", "virbr", "lxcbr", "cni", "podman", "wg", "tun", "tailscale", "zt"];

    public static IReadOnlyList<string> OfThisHost() => From(ReadInterfaces());

    public static IReadOnlyList<string> From(IEnumerable<InterfaceAddress> addresses)
    {
        var cidrs = new List<string>();

        foreach (var entry in addresses.Where(IsHomeNetworkAddress))
        {
            // A /16 is 65,000 hosts to ping: sweep only the /24 the host itself sits in.
            var prefixLength = Math.Clamp(entry.PrefixLength, WidestSweptPrefix, 32);
            var mask = uint.MaxValue << (32 - prefixLength);
            var network = ToIPAddress(ToUInt32(entry.Address) & mask);
            var cidr = $"{network}/{prefixLength}";
            if (!cidrs.Contains(cidr))
            {
                cidrs.Add(cidr);
            }
        }

        return cidrs;
    }

    private static bool IsHomeNetworkAddress(InterfaceAddress entry) =>
        entry.IsUp
        && entry.Type is not (NetworkInterfaceType.Loopback or NetworkInterfaceType.Tunnel)
        && !VirtualInterfacePrefixes.Any(prefix => entry.InterfaceName.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        && entry.Address.AddressFamily == AddressFamily.InterNetwork
        && IsPrivate(entry.Address);

    // RFC 1918 only, which also leaves out loopback and link-local (169.254.0.0/16).
    private static bool IsPrivate(IPAddress address)
    {
        var bytes = address.GetAddressBytes();
        return bytes[0] == 10
            || (bytes[0] == 172 && bytes[1] is >= 16 and <= 31)
            || (bytes[0] == 192 && bytes[1] == 168);
    }

    private static IEnumerable<InterfaceAddress> ReadInterfaces() =>
        NetworkInterface.GetAllNetworkInterfaces().SelectMany(networkInterface =>
            networkInterface.GetIPProperties().UnicastAddresses.Select(unicast => new InterfaceAddress(
                networkInterface.Name,
                networkInterface.NetworkInterfaceType,
                networkInterface.OperationalStatus == OperationalStatus.Up,
                unicast.Address,
                unicast.PrefixLength)));

    internal static uint ToUInt32(IPAddress address)
    {
        var bytes = address.GetAddressBytes();
        return ((uint)bytes[0] << 24) | ((uint)bytes[1] << 16) | ((uint)bytes[2] << 8) | bytes[3];
    }

    internal static IPAddress ToIPAddress(uint value) =>
        new([(byte)(value >> 24), (byte)(value >> 16), (byte)(value >> 8), (byte)value]);
}
