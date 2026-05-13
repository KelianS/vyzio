using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;
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

        foreach (var candidate in await DiscoverConfiguredHttpCandidatesAsync(ct))
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

                yield return BuildQualifiedCandidate(
                    ToDisplayName(uri.Host),
                    uri.Host,
                    554,
                    "onvif",
                    null,
                    "onvif",
                    $"ONVIF device announced via {uri.Host}:{uri.Port}.",
                    null);
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
                results.Add(BuildQualifiedCandidate(
                    probe.DisplayName,
                    probe.Host,
                    probe.Port,
                    "rtsp_manual",
                    probe.StreamPath,
                    "rtsp_probe",
                    probe.Note,
                    null));
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

    private async Task<IReadOnlyList<CameraDiscoveryCandidate>> DiscoverConfiguredHttpCandidatesAsync(CancellationToken ct)
    {
        var hosts = BuildConfiguredHostList();
        if (hosts.Count == 0)
        {
            return [];
        }

        var results = new List<CameraDiscoveryCandidate>();
        using var gate = new SemaphoreSlim(settings.Discovery.MaxConcurrentProbes);

        var tasks = hosts
            .SelectMany(host => settings.Discovery.HttpPorts.Select(port => ProbeConfiguredHttpHostAsync(host, port, gate, ct)))
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

            var macAddress = await ResolveMacAddressAsync(host, ct);

            return BuildQualifiedCandidate(
                ToDisplayName(host),
                host,
                port,
                "rtsp_manual",
                null,
                "network_scan",
                $"RTSP port {port} responded during configured LAN scan. Complete the RTSP path before verification.",
                macAddress);
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<CameraDiscoveryCandidate?> ProbeConfiguredHttpHostAsync(string host, int port, SemaphoreSlim gate, CancellationToken ct)
    {
        await gate.WaitAsync(ct);

        try
        {
            var probe = await ProbeHttpEndpointAsync(host, port, settings.Discovery.ProbeTimeoutMs, ct);
            if (probe is null)
            {
                return null;
            }

            var macAddress = await ResolveMacAddressAsync(host, ct);

            return BuildQualifiedCandidate(
                probe.DisplayName,
                host,
                port,
                "web_setup",
                null,
                "http_probe",
                probe.Note,
                macAddress);
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

    private static async Task<HttpProbeResult?> ProbeHttpEndpointAsync(string host, int port, int timeoutMs, CancellationToken ct)
    {
        try
        {
            using var client = new TcpClient();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromMilliseconds(timeoutMs));

            await client.ConnectAsync(host, port, timeout.Token);

            using var stream = client.GetStream();
            var request = $"GET / HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\nUser-Agent: Vyzio\r\n\r\n";
            var bytes = Encoding.ASCII.GetBytes(request);

            await stream.WriteAsync(bytes, timeout.Token);
            await stream.FlushAsync(timeout.Token);

            var buffer = new byte[4096];
            var read = await stream.ReadAsync(buffer, timeout.Token);
            if (read <= 0)
            {
                return null;
            }

            var response = Encoding.UTF8.GetString(buffer, 0, read);
            if (!response.StartsWith("HTTP/", StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            return BuildHttpProbeResult(host, port, response);
        }
        catch
        {
            return null;
        }
    }

    private static async Task<string?> ResolveMacAddressAsync(string host, CancellationToken ct)
    {
        try
        {
            var addresses = await Dns.GetHostAddressesAsync(host, ct);
            var address = addresses.FirstOrDefault(candidate => candidate.AddressFamily == AddressFamily.InterNetwork);
            if (address is null)
            {
                return null;
            }

            return ResolveMacAddress(address);
        }
        catch
        {
            return null;
        }
    }

    private static string? ResolveMacAddress(IPAddress address)
    {
        if (!OperatingSystem.IsLinux())
        {
            return null;
        }

        const string arpTablePath = "/proc/net/arp";
        if (!File.Exists(arpTablePath))
        {
            return null;
        }

        try
        {
            var ip = address.ToString();
            foreach (var line in File.ReadLines(arpTablePath).Skip(1))
            {
                var columns = line.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (columns.Length < 4)
                {
                    continue;
                }

                if (!string.Equals(columns[0], ip, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var mac = columns[3];
                return IsValidMacAddress(mac) ? mac.ToUpperInvariant() : null;
            }
        }
        catch
        {
            return null;
        }

        return null;
    }

    private static HttpProbeResult BuildHttpProbeResult(string host, int port, string response)
    {
        var fingerprint = response.ToLowerInvariant();
        var titleMatch = Regex.Match(response, "<title>(.*?)</title>", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        var title = titleMatch.Success ? WebUtility.HtmlDecode(titleMatch.Groups[1].Value.Trim()) : null;
        var server = response
            .Split("\r\n", StringSplitOptions.None)
            .FirstOrDefault(line => line.StartsWith("Server:", StringComparison.OrdinalIgnoreCase))?
            .Split(':', 2)[1]
            .Trim();

        if (fingerprint.Contains("tapo") || fingerprint.Contains("tp-link") || fingerprint.Contains("tplink"))
        {
            return new HttpProbeResult(
                "Camera TP-Link Tapo",
                $"Interface web TP-Link Tapo detectee sur {host}:{port}. RTSP et ONVIF sont souvent desactives d'origine et a activer dans l'application Tapo.");
        }

        if (fingerprint.Contains("onvif"))
        {
            return new HttpProbeResult(
                title ?? ToDisplayName(host),
                $"Service web camera detecte sur {host}:{port}. Un endpoint ONVIF semble present; finalisez ensuite l'activation video si necessaire.");
        }

        if (!string.IsNullOrWhiteSpace(title))
        {
            return new HttpProbeResult(
                title,
                $"Interface web camera detectee sur {host}:{port}. RTSP peut etre desactive d'origine; completez ensuite l'assistance de configuration.");
        }

        if (!string.IsNullOrWhiteSpace(server))
        {
            return new HttpProbeResult(
                ToDisplayName(host),
                $"Service web detecte sur {host}:{port} (serveur: {server}). RTSP peut etre desactive d'origine.");
        }

        return new HttpProbeResult(
            ToDisplayName(host),
            $"Service web detecte sur {host}:{port}. Cette camera peut necessiter une activation initiale via son interface constructeur.");
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

    private static bool IsValidMacAddress(string mac)
        => Regex.IsMatch(mac, "^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$");

    private static CameraDiscoveryCandidate BuildQualifiedCandidate(
        string displayName,
        string host,
        int port,
        string sourceType,
        string? streamPath,
        string discoverySource,
        string? note,
        string? macAddress)
    {
        var vendorFamily = DetectVendorFamily(displayName, note);
        var qualificationReasons = BuildQualificationReasons(sourceType, streamPath, discoverySource, vendorFamily, macAddress);

        return new CameraDiscoveryCandidate(
            displayName,
            host,
            port,
            sourceType,
            streamPath,
            discoverySource,
            note,
            macAddress,
            DetermineQualification(qualificationReasons),
            DetermineSupportLevel(vendorFamily),
            vendorFamily,
            qualificationReasons);
    }

    private static string? DetectVendorFamily(string displayName, string? note)
    {
        var fingerprint = $"{displayName} {note}".ToLowerInvariant();

        if (fingerprint.Contains("tapo") || fingerprint.Contains("tp-link") || fingerprint.Contains("tplink"))
        {
            return "tplink_tapo";
        }

        return null;
    }

    private static IReadOnlyList<string> BuildQualificationReasons(
        string sourceType,
        string? streamPath,
        string discoverySource,
        string? vendorFamily,
        string? macAddress)
    {
        var reasons = new List<string>();

        if (string.Equals(discoverySource, "onvif", StringComparison.OrdinalIgnoreCase))
        {
            reasons.Add("onvif_detected");
        }

        if (string.Equals(discoverySource, "network_scan", StringComparison.OrdinalIgnoreCase)
            || string.Equals(discoverySource, "rtsp_probe", StringComparison.OrdinalIgnoreCase)
            || sourceType.Contains("rtsp", StringComparison.OrdinalIgnoreCase))
        {
            reasons.Add("rtsp_responding");
        }

        if (string.Equals(discoverySource, "http_probe", StringComparison.OrdinalIgnoreCase))
        {
            reasons.Add("http_camera_signature");
        }

        if (!string.IsNullOrWhiteSpace(streamPath))
        {
            reasons.Add("rtsp_path_known");
        }

        if (!string.IsNullOrWhiteSpace(vendorFamily))
        {
            reasons.Add("vendor_hint_detected");
        }

        if (!string.IsNullOrWhiteSpace(macAddress))
        {
            reasons.Add("mac_address_observed");
        }

        return reasons;
    }

    private static string DetermineQualification(IReadOnlyList<string> qualificationReasons)
    {
        if (qualificationReasons.Contains("onvif_detected", StringComparer.Ordinal)
            || (qualificationReasons.Contains("rtsp_responding", StringComparer.Ordinal)
                && qualificationReasons.Contains("rtsp_path_known", StringComparer.Ordinal)))
        {
            return "camera_confirmed";
        }

        if (qualificationReasons.Contains("rtsp_responding", StringComparer.Ordinal)
            || qualificationReasons.Contains("http_camera_signature", StringComparer.Ordinal))
        {
            return "camera_likely";
        }

        return "device_unknown";
    }

    private static string DetermineSupportLevel(string? vendorFamily)
        => vendorFamily switch
        {
            "tplink_tapo" => "guided",
            _ => "unknown"
        };

    private sealed record HttpProbeResult(string DisplayName, string Note);
}