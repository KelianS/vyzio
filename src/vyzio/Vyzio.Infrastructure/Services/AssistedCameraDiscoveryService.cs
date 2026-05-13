using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Configuration;

namespace Vyzio.Infrastructure.Services;

public sealed class AssistedCameraDiscoveryService(VyzioRuntimeSettings settings, ILogger<AssistedCameraDiscoveryService>? logger = null) : ICameraDiscoveryService
{
    private static readonly IPAddress DiscoveryAddress = IPAddress.Parse("239.255.255.250");
    private static readonly IPEndPoint DiscoveryEndpoint = new(DiscoveryAddress, 3702);
    private const int MaxConfiguredProbeHosts = 1024;

    public async Task<IReadOnlyList<CameraDiscoveryCandidate>> DiscoverAsync(CancellationToken ct = default)
    {
        logger?.LogInformation(
            "Starting assisted camera discovery. AutoDetectLocalCidrs={AutoDetectLocalCidrs}, ProbeHosts={ProbeHostsCount}, ProbeCidrs={ProbeCidrsCount}, RtspPorts={RtspPorts}, HttpPorts={HttpPorts}, OnvifPorts={OnvifPorts}",
            settings.Discovery.AutoDetectLocalCidrs,
            settings.Discovery.ProbeHosts.Count,
            settings.Discovery.ProbeCidrs.Count,
            string.Join(',', settings.Discovery.RtspPorts),
            string.Join(',', settings.Discovery.HttpPorts),
            string.Join(',', settings.Discovery.OnvifPorts));

        var candidates = new List<CameraDiscoveryCandidate>();

        var onvifCandidates = await DiscoverOnvifCandidatesAsync(ct);
        logger?.LogInformation("ONVIF multicast discovery returned {CandidateCount} candidate(s).", onvifCandidates.Count);
        candidates.AddRange(onvifCandidates);

        var knownRtspCandidates = await DiscoverKnownRtspCandidatesAsync(ct);
        logger?.LogInformation("Known RTSP probes returned {CandidateCount} candidate(s).", knownRtspCandidates.Count);
        candidates.AddRange(knownRtspCandidates);

        var configuredRtspCandidates = await DiscoverConfiguredRtspCandidatesAsync(ct);
        logger?.LogInformation("Configured RTSP discovery returned {CandidateCount} candidate(s).", configuredRtspCandidates.Count);
        candidates.AddRange(configuredRtspCandidates);

        var configuredOnvifCandidates = await DiscoverConfiguredOnvifCandidatesAsync(ct);
        logger?.LogInformation("Configured ONVIF unicast discovery returned {CandidateCount} candidate(s).", configuredOnvifCandidates.Count);
        candidates.AddRange(configuredOnvifCandidates);

        var configuredHttpCandidates = await DiscoverConfiguredHttpCandidatesAsync(ct);
        logger?.LogInformation("Configured HTTP discovery returned {CandidateCount} candidate(s).", configuredHttpCandidates.Count);
        candidates.AddRange(configuredHttpCandidates);

        var hostnameCandidates = await DiscoverConfiguredHostnameCandidatesAsync(ct);
        logger?.LogInformation("Hostname discovery returned {CandidateCount} candidate(s).", hostnameCandidates.Count);
        candidates.AddRange(hostnameCandidates);

        var macVendorCandidates = await DiscoverConfiguredMacVendorCandidatesAsync(ct);
        logger?.LogInformation("MAC/OUI discovery returned {CandidateCount} candidate(s).", macVendorCandidates.Count);
        candidates.AddRange(macVendorCandidates);

        var result = candidates
            .GroupBy(candidate => candidate.Host, StringComparer.OrdinalIgnoreCase)
            .Select(MergeCandidates)
            .OrderByDescending(GetCandidatePriority)
            .ThenBy(candidate => candidate.DisplayName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        logger?.LogInformation("Assisted camera discovery completed with {CandidateCount} unique candidate(s).", result.Count);
        return result;
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
                    null,
                    ["onvif_detected"]);
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
                    null,
                    ["rtsp_responding"]));
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

    private async Task<IReadOnlyList<CameraDiscoveryCandidate>> DiscoverConfiguredOnvifCandidatesAsync(CancellationToken ct)
    {
        var hosts = BuildConfiguredHostList();
        if (hosts.Count == 0)
        {
            return [];
        }

        var results = new List<CameraDiscoveryCandidate>();
        using var gate = new SemaphoreSlim(settings.Discovery.MaxConcurrentProbes);

        var tasks = hosts
            .SelectMany(host => settings.Discovery.OnvifPorts.Select(port => ProbeConfiguredOnvifHostAsync(host, port, gate, ct)))
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

    private static CameraDiscoveryCandidate MergeCandidates(IGrouping<string, CameraDiscoveryCandidate> group)
    {
        var ordered = group
            .OrderByDescending(GetCandidatePriority)
            .ThenByDescending(candidate => candidate.QualificationReasons.Count)
            .ThenBy(candidate => candidate.Port == 0 ? 1 : 0)
            .ToList();

        var primary = ordered[0];
        var hostnameHint = ordered.FirstOrDefault(candidate => string.Equals(candidate.DiscoverySource, "hostname_probe", StringComparison.OrdinalIgnoreCase));
        var vendorHint = ordered.FirstOrDefault(candidate => !string.IsNullOrWhiteSpace(candidate.VendorFamily));
        var namedCandidate = ordered.FirstOrDefault(candidate => !LooksLikeHostLabel(candidate.DisplayName, candidate.Host));
        var macCandidate = ordered.FirstOrDefault(candidate => !string.IsNullOrWhiteSpace(candidate.MacAddress));

        var mergedReasons = ordered
            .SelectMany(candidate => candidate.QualificationReasons)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        return primary with
        {
            DisplayName = namedCandidate?.DisplayName ?? hostnameHint?.DisplayName ?? primary.DisplayName,
            Note = primary.Note,
            MacAddress = macCandidate?.MacAddress ?? primary.MacAddress,
            SupportLevel = ordered
                .OrderByDescending(candidate => GetSupportLevelPriority(candidate.SupportLevel))
                .Select(candidate => candidate.SupportLevel)
                .First(),
            VendorFamily = vendorHint?.VendorFamily ?? primary.VendorFamily,
            QualificationReasons = mergedReasons,
        };
    }

    private async Task<IReadOnlyList<CameraDiscoveryCandidate>> DiscoverConfiguredMacVendorCandidatesAsync(CancellationToken ct)
    {
        var hosts = BuildConfiguredHostList();
        if (hosts.Count == 0)
        {
            return [];
        }

        var results = new List<CameraDiscoveryCandidate>();

        foreach (var host in hosts)
        {
            ct.ThrowIfCancellationRequested();

            var macAddress = await ResolveMacAddressAsync(host, ct);
            var vendorFamily = DetectVendorFamily(null, null, macAddress);
            if (string.IsNullOrWhiteSpace(macAddress) || string.IsNullOrWhiteSpace(vendorFamily))
            {
                continue;
            }

            results.Add(BuildQualifiedCandidate(
                $"{FormatVendorFamily(vendorFamily)} probable",
                host,
                0,
                "vendor_probe",
                null,
                "mac_vendor_probe",
                $"Equipement {FormatVendorFamily(vendorFamily)} detecte via l'adresse MAC {macAddress}. Les services video ne repondent pas encore ou sont desactives.",
                macAddress,
                ["vendor_oui_match"]));

            logger?.LogDebug("MAC/OUI candidate detected for host {Host} with vendor family {VendorFamily}.", host, vendorFamily);
        }

        return results;
    }

    private async Task<IReadOnlyList<CameraDiscoveryCandidate>> DiscoverConfiguredHostnameCandidatesAsync(CancellationToken ct)
    {
        var hosts = BuildConfiguredHostList();
        if (hosts.Count == 0)
        {
            return [];
        }

        var results = new List<CameraDiscoveryCandidate>();

        foreach (var host in hosts)
        {
            ct.ThrowIfCancellationRequested();

            var hostName = await ResolveHostNameAsync(host, ct);
            if (string.IsNullOrWhiteSpace(hostName))
            {
                continue;
            }

            var vendorFamily = DetectVendorFamily(hostName, null, null);
            var hostReasons = BuildHostHintReasons(hostName, vendorFamily);
            if (hostReasons.Count == 0)
            {
                continue;
            }

            var vendorLabel = vendorFamily is null ? "probable" : FormatVendorFamily(vendorFamily);

            results.Add(BuildQualifiedCandidate(
                ToDisplayName(hostName),
                host,
                0,
                "vendor_probe",
                null,
                "hostname_probe",
                $"Le nom reseau {hostName} ressemble a une camera {vendorLabel}.",
                null,
                hostReasons));

            logger?.LogDebug("Hostname candidate detected for host {Host} with hostname {HostName} and vendor family {VendorFamily}.", host, hostName, vendorFamily ?? "unknown");
        }

        return results;
    }

    private async Task<CameraDiscoveryCandidate?> ProbeConfiguredHostAsync(string host, int port, SemaphoreSlim gate, CancellationToken ct)
    {
        await gate.WaitAsync(ct);

        try
        {
            var streamPath = await ProbeRtspPathsAsync(host, port, settings.Discovery.RtspPaths, settings.Discovery.ProbeTimeoutMs, ct);
            if (!string.IsNullOrWhiteSpace(streamPath))
            {
                var resolvedMacAddress = await ResolveMacAddressAsync(host, ct);

                return BuildQualifiedCandidate(
                    ToDisplayName(host),
                    host,
                    port,
                    "rtsp_manual",
                    streamPath,
                    "rtsp_describe",
                    $"RTSP repond sur {host}:{port} avec un chemin exploitable ({streamPath}).",
                        resolvedMacAddress,
                    ["rtsp_responding"]);
            }

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
                macAddress,
                ["rtsp_responding"]);
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<CameraDiscoveryCandidate?> ProbeConfiguredOnvifHostAsync(string host, int port, SemaphoreSlim gate, CancellationToken ct)
    {
        await gate.WaitAsync(ct);

        try
        {
            var probe = await ProbeOnvifUnicastEndpointAsync(host, port, settings.Discovery.ProbeTimeoutMs, ct);
            if (probe is null)
            {
                return null;
            }

            var macAddress = await ResolveMacAddressAsync(host, ct);

            return BuildQualifiedCandidate(
                probe.DisplayName,
                host,
                port,
                probe.SourceType,
                null,
                probe.DiscoverySource,
                probe.Note,
                macAddress,
                probe.QualificationReasons);
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
            var probe = await ProbeOnvifUnicastEndpointAsync(host, port, settings.Discovery.ProbeTimeoutMs, ct)
                ?? await ProbeHttpEndpointAsync(host, port, settings.Discovery.ProbeTimeoutMs, ct);

            if (probe is null)
            {
                return null;
            }

            var macAddress = await ResolveMacAddressAsync(host, ct);

            return BuildQualifiedCandidate(
                probe.DisplayName,
                host,
                port,
                probe.SourceType,
                null,
                probe.DiscoverySource,
                probe.Note,
                macAddress,
                probe.QualificationReasons);
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

    private static int GetCandidatePriority(CameraDiscoveryCandidate candidate)
    {
        var qualification = candidate.Qualification switch
        {
            "camera_confirmed" => 300,
            "camera_likely" => 200,
            _ => 100,
        };

        var discovery = candidate.DiscoverySource switch
        {
            "onvif_unicast" => 60,
            "onvif" => 55,
            "rtsp_describe" => 50,
            "http_probe" => 40,
            "network_scan" => 30,
            "hostname_probe" => 20,
            "mac_vendor_probe" => 10,
            _ => 0,
        };

        var support = GetSupportLevelPriority(candidate.SupportLevel) * 5;
        var stream = string.IsNullOrWhiteSpace(candidate.StreamPath) ? 0 : 5;
        var mac = string.IsNullOrWhiteSpace(candidate.MacAddress) ? 0 : 2;

        return qualification + discovery + support + stream + mac;
    }

    private static int GetSupportLevelPriority(string supportLevel) => supportLevel switch
    {
        "supported" => 4,
        "guided" => 3,
        "experimental" => 2,
        _ => 1,
    };

    private static bool LooksLikeHostLabel(string displayName, string host)
    {
        return string.Equals(displayName, host, StringComparison.OrdinalIgnoreCase)
            || string.Equals(displayName, ToDisplayName(host), StringComparison.OrdinalIgnoreCase);
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

    private static async Task<string?> ProbeRtspPathsAsync(
        string host,
        int port,
        IReadOnlyList<string> paths,
        int timeoutMs,
        CancellationToken ct)
    {
        foreach (var path in paths)
        {
            if (await CanDescribeRtspPathAsync(host, port, path, timeoutMs, ct))
            {
                return path;
            }
        }

        return null;
    }

    private static async Task<bool> CanDescribeRtspPathAsync(string host, int port, string path, int timeoutMs, CancellationToken ct)
    {
        try
        {
            using var client = new TcpClient();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromMilliseconds(timeoutMs));

            await client.ConnectAsync(host, port, timeout.Token);

            using var stream = client.GetStream();
            var request =
                $"DESCRIBE rtsp://{host}:{port}{path} RTSP/1.0\r\n" +
                "CSeq: 1\r\n" +
                "Accept: application/sdp\r\n" +
                "User-Agent: Vyzio\r\n\r\n";

            var bytes = Encoding.ASCII.GetBytes(request);
            await stream.WriteAsync(bytes, timeout.Token);
            await stream.FlushAsync(timeout.Token);

            var buffer = new byte[4096];
            var read = await stream.ReadAsync(buffer, timeout.Token);
            if (read <= 0)
            {
                return false;
            }

            var response = Encoding.UTF8.GetString(buffer, 0, read);
            return response.StartsWith("RTSP/1.0 200", StringComparison.OrdinalIgnoreCase)
                || response.StartsWith("RTSP/1.0 401", StringComparison.OrdinalIgnoreCase);
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

    private static async Task<HttpProbeResult?> ProbeOnvifUnicastEndpointAsync(string host, int port, int timeoutMs, CancellationToken ct)
    {
        try
        {
            using var client = new TcpClient();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromMilliseconds(timeoutMs));

            await client.ConnectAsync(host, port, timeout.Token);

            using var stream = client.GetStream();
            var request = $"POST /onvif/device_service HTTP/1.1\r\nHost: {host}\r\nContent-Type: application/soap+xml; charset=utf-8\r\nConnection: close\r\nUser-Agent: Vyzio\r\nContent-Length: {Encoding.UTF8.GetByteCount(BuildOnvifGetCapabilitiesEnvelope())}\r\n\r\n{BuildOnvifGetCapabilitiesEnvelope()}";
            var bytes = Encoding.UTF8.GetBytes(request);

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

            if (response.Contains(" 404 ", StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            var normalized = response.ToLowerInvariant();
            var hasOnvifSignal = normalized.Contains("onvif")
                || normalized.Contains("soap")
                || normalized.Contains("www-authenticate:")
                || response.Contains(" 401 ", StringComparison.OrdinalIgnoreCase);

            if (!hasOnvifSignal)
            {
                return null;
            }

            return new HttpProbeResult(
                ToDisplayName(host),
                $"Endpoint ONVIF unicast detecte sur {host}:{port}. La camera peut etre integree meme sans interface web exploitable.",
                "onvif",
                "onvif_unicast",
                ["onvif_detected"]);
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

    private static async Task<string?> ResolveHostNameAsync(string host, CancellationToken ct)
    {
        if (!IPAddress.TryParse(host, out _))
        {
            return host;
        }

        try
        {
            var entry = await Dns.GetHostEntryAsync(host, ct);
            if (string.IsNullOrWhiteSpace(entry.HostName))
            {
                return null;
            }

            return entry.HostName.TrimEnd('.');
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
                $"Interface web TP-Link Tapo detectee sur {host}:{port}. RTSP et ONVIF sont souvent desactives d'origine et a activer dans l'application Tapo.",
                "web_setup",
                "http_probe",
                ["http_camera_signature"]);
        }

        if (fingerprint.Contains("onvif"))
        {
            return new HttpProbeResult(
                title ?? ToDisplayName(host),
                $"Service web camera detecte sur {host}:{port}. Un endpoint ONVIF semble present; finalisez ensuite l'activation video si necessaire.",
                "onvif",
                "http_probe",
                ["onvif_detected"]);
        }

        if (LooksLikeCameraWebInterface(fingerprint, title, server))
        {
            return new HttpProbeResult(
                title ?? ToDisplayName(host),
                $"Interface web camera detectee sur {host}:{port}. RTSP peut etre desactive d'origine; completez ensuite l'assistance de configuration.",
                "web_setup",
                "http_probe",
                ["http_camera_signature"]);
        }

        if (!string.IsNullOrWhiteSpace(server))
        {
            return new HttpProbeResult(
                ToDisplayName(host),
                $"Service web generique detecte sur {host}:{port} (serveur: {server}). Ce signal seul ne suffit pas a qualifier une camera.",
                "web_setup",
                "http_service",
                ["http_service_detected"]);
        }

        if (!string.IsNullOrWhiteSpace(title))
        {
            return new HttpProbeResult(
                title,
                $"Service web generique detecte sur {host}:{port}. Ce signal seul ne suffit pas a qualifier une camera.",
                "web_setup",
                "http_service",
                ["http_service_detected"]);
        }

        return new HttpProbeResult(
            ToDisplayName(host),
            $"Service web generique detecte sur {host}:{port}. Ce signal seul ne suffit pas a qualifier une camera.",
            "web_setup",
            "http_service",
            ["http_service_detected"]);
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

    private static string BuildOnvifGetCapabilitiesEnvelope() =>
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
        "<s:Envelope xmlns:s=\"http://www.w3.org/2003/05/soap-envelope\">" +
        "<s:Body>" +
        "<GetCapabilities xmlns=\"http://www.onvif.org/ver10/device/wsdl\">" +
        "<Category>All</Category>" +
        "</GetCapabilities>" +
        "</s:Body>" +
        "</s:Envelope>";

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

    private static bool LooksLikeCameraWebInterface(string fingerprint, string? title, string? server)
    {
        var combined = $"{fingerprint} {title} {server}";
        var markers = new[]
        {
            "camera",
            "ipcam",
            "network camera",
            "webcam",
            "nvr",
            "dvr",
            "hikvision",
            "dahua",
            "reolink",
            "amcrest",
            "foscam",
            "uniview",
            "axis"
        };

        return markers.Any(marker => combined.Contains(marker, StringComparison.OrdinalIgnoreCase));
    }

    private static CameraDiscoveryCandidate BuildQualifiedCandidate(
        string displayName,
        string host,
        int port,
        string sourceType,
        string? streamPath,
        string discoverySource,
        string? note,
        string? macAddress,
        IReadOnlyList<string>? primaryReasons = null)
    {
        var vendorFamily = DetectVendorFamily(displayName, note, macAddress);
        var qualificationReasons = BuildQualificationReasons(streamPath, vendorFamily, macAddress, primaryReasons);

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

    private static string? DetectVendorFamily(string? displayName, string? note, string? macAddress)
    {
        var fingerprint = $"{displayName} {note}".ToLowerInvariant();
        var oui = NormalizeOui(macAddress);

        if (fingerprint.Contains("tapo") || fingerprint.Contains("tp-link") || fingerprint.Contains("tplink"))
        {
            return "tplink_tapo";
        }

        if (oui is "5C:62:8B")
        {
            return "tplink_tapo";
        }

        return null;
    }

    private static IReadOnlyList<string> BuildQualificationReasons(
        string? streamPath,
        string? vendorFamily,
        string? macAddress,
        IReadOnlyList<string>? primaryReasons)
    {
        var reasons = primaryReasons is null
            ? []
            : primaryReasons.Distinct(StringComparer.Ordinal).ToList();

        if (!string.IsNullOrWhiteSpace(streamPath))
        {
            AddReason(reasons, "rtsp_path_known");
        }

        if (!string.IsNullOrWhiteSpace(vendorFamily))
        {
            AddReason(reasons, "vendor_hint_detected");
        }

        if (!string.IsNullOrWhiteSpace(macAddress))
        {
            AddReason(reasons, "mac_address_observed");
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
            || qualificationReasons.Contains("http_camera_signature", StringComparer.Ordinal)
            || qualificationReasons.Contains("vendor_oui_match", StringComparer.Ordinal)
            || qualificationReasons.Contains("hostname_camera_hint", StringComparer.Ordinal))
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

    private static string FormatVendorFamily(string vendorFamily)
        => vendorFamily switch
        {
            "tplink_tapo" => "TP-Link Tapo",
            _ => vendorFamily
        };

    private static IReadOnlyList<string> BuildHostHintReasons(string hostName, string? vendorFamily)
    {
        var reasons = new List<string>();
        var normalized = hostName.ToLowerInvariant();

        if (normalized.Contains("camera")
            || normalized.Contains("ipcam")
            || normalized.Contains("webcam")
            || normalized.Contains("tapo")
            || Regex.IsMatch(normalized, @"\bc\d{2,3}\b"))
        {
            reasons.Add("hostname_camera_hint");
        }

        if (!string.IsNullOrWhiteSpace(vendorFamily))
        {
            AddReason(reasons, "vendor_hint_detected");
        }

        return reasons;
    }

    private static string? NormalizeOui(string? macAddress)
    {
        if (string.IsNullOrWhiteSpace(macAddress))
        {
            return null;
        }

        var octets = macAddress
            .Split(':', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Take(3)
            .ToArray();

        return octets.Length == 3
            ? string.Join(':', octets).ToUpperInvariant()
            : null;
    }

    private static void AddReason(List<string> reasons, string reason)
    {
        if (!reasons.Contains(reason, StringComparer.Ordinal))
        {
            reasons.Add(reason);
        }
    }

    private sealed record HttpProbeResult(
        string DisplayName,
        string Note,
        string SourceType,
        string DiscoverySource,
        IReadOnlyList<string> QualificationReasons);
}