using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Xml.Linq;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Configuration;

namespace Vyzio.Infrastructure.Services;

public sealed class AssistedCameraDiscoveryService(VyzioRuntimeSettings settings) : ICameraDiscoveryService
{
    private static readonly IPAddress DiscoveryAddress = IPAddress.Parse("239.255.255.250");
    private static readonly IPEndPoint DiscoveryEndpoint = new(DiscoveryAddress, 3702);
    private const int MaxConfiguredProbeHosts = 1024;

    public async Task<IReadOnlyList<CameraDiscoveryCandidate>> DiscoverAsync(CancellationToken ct = default)
    {
        var candidates = new Dictionary<string, CameraDiscoveryCandidate>(StringComparer.OrdinalIgnoreCase);

        foreach (var candidate in await DiscoverOnvifCandidatesAsync(ct))
        {
            candidates[$"{candidate.Host}:{candidate.Port}:{candidate.StreamPath}"] = candidate;
        }

        foreach (var candidate in await DiscoverKnownRtspCandidatesAsync(ct))
        {
            candidates[$"{candidate.Host}:{candidate.Port}:{candidate.StreamPath}"] = candidate;
        }

        foreach (var candidate in await DiscoverConfiguredRtspCandidatesAsync(ct))
        {
            candidates[$"{candidate.Host}:{candidate.Port}:{candidate.StreamPath}"] = candidate;
        }

        return candidates.Values
            .OrderBy(candidate => candidate.DisplayName, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static async Task<IReadOnlyList<CameraDiscoveryCandidate>> DiscoverOnvifCandidatesAsync(CancellationToken ct)
    {
        var results = new List<CameraDiscoveryCandidate>();
        using var udpClient = new UdpClient(AddressFamily.InterNetwork)
        {
            EnableBroadcast = true,
            MulticastLoopback = false,
        };

        var probePayload = Encoding.UTF8.GetBytes(BuildProbeEnvelope());
        await udpClient.SendAsync(probePayload, probePayload.Length, DiscoveryEndpoint);

        var deadline = DateTimeOffset.UtcNow.AddSeconds(2);

        while (DateTimeOffset.UtcNow < deadline && !ct.IsCancellationRequested)
        {
            var receiveTask = udpClient.ReceiveAsync(ct).AsTask();
            var remaining = deadline - DateTimeOffset.UtcNow;
            if (remaining <= TimeSpan.Zero)
            {
                break;
            }

            var completed = await Task.WhenAny(receiveTask, Task.Delay(remaining, ct));
            if (completed != receiveTask)
            {
                break;
            }

            UdpReceiveResult response;

            try
            {
                response = await receiveTask;
            }
            catch
            {
                break;
            }

            var responseText = Encoding.UTF8.GetString(response.Buffer);
            foreach (var candidate in ParseOnvifCandidates(responseText))
            {
                results.Add(candidate);
            }
        }

        return results;
    }

    private static IEnumerable<CameraDiscoveryCandidate> ParseOnvifCandidates(string xml)
    {
        XDocument document;

        try
        {
            document = XDocument.Parse(xml);
        }
        catch
        {
            yield break;
        }

        var xAddresses = document.Descendants().Where(node => node.Name.LocalName == "XAddrs");
        foreach (var xAddress in xAddresses)
        {
            var values = xAddress.Value
                .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            foreach (var value in values)
            {
                if (!Uri.TryCreate(value, UriKind.Absolute, out var uri))
                {
                    continue;
                }

                yield return new CameraDiscoveryCandidate(
                    ToDisplayName(uri.Host),
                    uri.Host,
                    554,
                    "onvif",
                    null,
                    "onvif",
                    $"ONVIF device announced via {uri.Host}:{uri.Port}.");
            }
        }
    }

    private static async Task<IReadOnlyList<CameraDiscoveryCandidate>> DiscoverKnownRtspCandidatesAsync(CancellationToken ct)
    {
        var probes = new (string Host, int Port, string StreamPath, string DisplayName, string Note)[]
        {
            ("127.0.0.1", 8554, "/test-camera", "Camera locale mock", "RTSP relay detected on the local mock stream."),
            ("localhost", 8554, "/test-camera", "Camera locale mock", "RTSP relay detected on the local mock stream."),
            ("mediamtx", 8554, "/test-camera", "Camera mock Docker", "RTSP relay detected on the Docker mock stream."),
        };

        var results = new List<CameraDiscoveryCandidate>();

        foreach (var probe in probes)
        {
            if (await CanConnectAsync(probe.Host, probe.Port, 250, ct))
            {
                results.Add(new CameraDiscoveryCandidate(
                    probe.DisplayName,
                    probe.Host,
                    probe.Port,
                    "rtsp_manual",
                    probe.StreamPath,
                    "rtsp_probe",
                    probe.Note));
            }
        }

        return results;
    }

    private async Task<IReadOnlyList<CameraDiscoveryCandidate>> DiscoverConfiguredRtspCandidatesAsync(CancellationToken ct)
    {
        var hosts = BuildConfiguredHostList();
        if (hosts.Count == 0)
        {
            return [];
        }

        var results = new List<CameraDiscoveryCandidate>();
        using var gate = new SemaphoreSlim(settings.Discovery.MaxConcurrentProbes);

        var tasks = hosts
            .SelectMany(host => settings.Discovery.RtspPorts.Select(port => ProbeConfiguredHostAsync(host, port, gate, ct)))
            .ToArray();

        var probed = await Task.WhenAll(tasks);
        foreach (var candidate in probed)
        {
            if (candidate is not null)
            {
                results.Add(candidate);
            }
        }

        return results;
    }

    private async Task<CameraDiscoveryCandidate?> ProbeConfiguredHostAsync(string host, int port, SemaphoreSlim gate, CancellationToken ct)
    {
        await gate.WaitAsync(ct);

        try
        {
            if (!await CanConnectAsync(host, port, settings.Discovery.ProbeTimeoutMs, ct))
            {
                return null;
            }

            return new CameraDiscoveryCandidate(
                ToDisplayName(host),
                host,
                port,
                "rtsp_manual",
                null,
                "network_scan",
                $"RTSP port {port} responded during configured LAN scan. Complete the RTSP path before verification.");
        }
        finally
        {
            gate.Release();
        }
    }

    private IReadOnlyList<string> BuildConfiguredHostList()
    {
        var hosts = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var host in settings.Discovery.ProbeHosts)
        {
            hosts.Add(host);
        }

        foreach (var cidr in settings.Discovery.ProbeCidrs)
        {
            foreach (var host in EnumerateHosts(cidr))
            {
                if (hosts.Count >= MaxConfiguredProbeHosts)
                {
                    return hosts.ToList();
                }

                hosts.Add(host);
            }
        }

        if (settings.Discovery.AutoDetectLocalCidrs)
        {
            foreach (var cidr in DetectLocalCidrs())
            {
                foreach (var host in EnumerateHosts(cidr))
                {
                    if (hosts.Count >= MaxConfiguredProbeHosts)
                    {
                        return hosts.ToList();
                    }

                    hosts.Add(host);
                }
            }
        }

        return hosts.ToList();
    }

    private static IReadOnlyList<string> DetectLocalCidrs()
    {
        var cidrs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var networkInterface in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (networkInterface.OperationalStatus != OperationalStatus.Up)
            {
                continue;
            }

            if (networkInterface.NetworkInterfaceType is NetworkInterfaceType.Loopback or NetworkInterfaceType.Tunnel)
            {
                continue;
            }

            var properties = networkInterface.GetIPProperties();
            foreach (var unicast in properties.UnicastAddresses)
            {
                if (unicast.Address.AddressFamily != AddressFamily.InterNetwork)
                {
                    continue;
                }

                if (!IsPrivateIpv4(unicast.Address))
                {
                    continue;
                }

                var prefixLength = unicast.PrefixLength;
                if (prefixLength <= 0 && unicast.IPv4Mask is not null)
                {
                    prefixLength = CountMaskBits(unicast.IPv4Mask);
                }

                if (prefixLength <= 0)
                {
                    prefixLength = 24;
                }

                var effectivePrefixLength = prefixLength < 24 ? 24 : prefixLength;
                var address = ToUInt32(unicast.Address);
                var mask = effectivePrefixLength == 0 ? 0u : uint.MaxValue << (32 - effectivePrefixLength);
                var network = FromUInt32(address & mask);
                cidrs.Add($"{network}/{effectivePrefixLength}");
            }
        }

        return cidrs.ToList();
    }

    private static IEnumerable<string> EnumerateHosts(string cidr)
    {
        var parts = cidr.Split('/', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 2 || !IPAddress.TryParse(parts[0], out var networkAddress) || networkAddress.AddressFamily != AddressFamily.InterNetwork)
        {
            yield break;
        }

        if (!int.TryParse(parts[1], out var prefixLength) || prefixLength is < 0 or > 32)
        {
            yield break;
        }

        var network = ToUInt32(networkAddress);
        var mask = prefixLength == 0 ? 0u : uint.MaxValue << (32 - prefixLength);
        var baseAddress = network & mask;
        var hostCount = prefixLength == 32 ? 1u : 1u << (32 - prefixLength);
        var start = prefixLength >= 31 ? 0u : 1u;
        var endExclusive = prefixLength >= 31 ? hostCount : hostCount - 1;

        for (var offset = start; offset < endExclusive; offset++)
        {
            yield return FromUInt32(baseAddress + offset).ToString();
        }
    }

    private static async Task<bool> CanConnectAsync(string host, int port, int timeoutMs, CancellationToken ct)
    {
        try
        {
            using var client = new TcpClient();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromMilliseconds(timeoutMs));
            await client.ConnectAsync(host, port, timeout.Token);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static string BuildProbeEnvelope() =>
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
        "<e:Envelope xmlns:e=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:w=\"http://schemas.xmlsoap.org/ws/2004/08/addressing\" xmlns:d=\"http://schemas.xmlsoap.org/ws/2005/04/discovery\" xmlns:dn=\"http://www.onvif.org/ver10/network/wsdl\">" +
        "<e:Header>" +
        $"<w:MessageID>uuid:{Guid.NewGuid():D}</w:MessageID>" +
        "<w:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>" +
        "<w:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>" +
        "</e:Header>" +
        "<e:Body><d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe></e:Body>" +
        "</e:Envelope>";

    private static string ToDisplayName(string host)
        => host.Replace('-', ' ').Replace('_', ' ');

    private static bool IsPrivateIpv4(IPAddress address)
    {
        var bytes = address.GetAddressBytes();
        return bytes[0] == 10
            || (bytes[0] == 172 && bytes[1] is >= 16 and <= 31)
            || (bytes[0] == 192 && bytes[1] == 168);
    }

    private static int CountMaskBits(IPAddress mask)
    {
        var bits = 0;

        foreach (var octet in mask.GetAddressBytes())
        {
            var value = octet;
            while (value > 0)
            {
                bits += value & 1;
                value >>= 1;
            }
        }

        return bits;
    }

    private static uint ToUInt32(IPAddress address)
    {
        var bytes = address.GetAddressBytes();
        return ((uint)bytes[0] << 24)
            | ((uint)bytes[1] << 16)
            | ((uint)bytes[2] << 8)
            | bytes[3];
    }

    private static IPAddress FromUInt32(uint value)
        => new([
            (byte)((value >> 24) & 0xFF),
            (byte)((value >> 16) & 0xFF),
            (byte)((value >> 8) & 0xFF),
            (byte)(value & 0xFF)]);
}