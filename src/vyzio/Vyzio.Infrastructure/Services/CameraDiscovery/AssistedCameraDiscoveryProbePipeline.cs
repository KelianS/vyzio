using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using Microsoft.Extensions.Logging;
using Vyzio.Infrastructure.Configuration;

namespace Vyzio.Infrastructure.Services.CameraDiscovery;

internal sealed class AssistedCameraDiscoveryProbePipeline
{
    private static readonly IPAddress DiscoveryAddress = IPAddress.Parse("239.255.255.250");
    private static readonly IPEndPoint DiscoveryEndpoint = new(DiscoveryAddress, 3702);
    private const int MaxConfiguredProbeHosts = 1024;

    private readonly ILogger? _logger;
    private readonly VyzioRuntimeSettings _settings;

    public AssistedCameraDiscoveryProbePipeline(VyzioRuntimeSettings settings, ILogger? logger = null)
    {
        _settings = settings;
        _logger = logger;
    }

    public async Task<IReadOnlyList<RawCameraDiscoverySignal>> DiscoverAsync(CancellationToken ct)
    {
        _logger?.LogInformation(
            "Starting assisted camera discovery. AutoDetectLocalCidrs={AutoDetectLocalCidrs}, ProbeHosts={ProbeHostsCount}, ProbeCidrs={ProbeCidrsCount}, RtspPorts={RtspPorts}, HttpPorts={HttpPorts}, OnvifPorts={OnvifPorts}",
            _settings.Discovery.AutoDetectLocalCidrs,
            _settings.Discovery.ProbeHosts.Count,
            _settings.Discovery.ProbeCidrs.Count,
            string.Join(',', _settings.Discovery.RtspPorts),
            string.Join(',', _settings.Discovery.HttpPorts),
            string.Join(',', _settings.Discovery.OnvifPorts));

        var configuredHosts = BuildConfiguredHostList();
        _logger?.LogInformation("Built configured discovery host list with {HostCount} host(s).", configuredHosts.Count);

        var onvifTask = DiscoverOnvifSignalsAsync(ct);
        var configuredRtspTask = DiscoverConfiguredRtspSignalsAsync(configuredHosts, ct);
        var configuredOnvifTask = DiscoverConfiguredOnvifSignalsAsync(configuredHosts, ct);
        var configuredHttpTask = DiscoverConfiguredHttpSignalsAsync(configuredHosts, ct);
        var hostnameTask = DiscoverHostnameSignalsAsync(configuredHosts, ct);
        var macTask = DiscoverMacVendorSignalsAsync(configuredHosts, ct);

        await Task.WhenAll(
            onvifTask,
            configuredRtspTask,
            configuredOnvifTask,
            configuredHttpTask,
            hostnameTask,
            macTask);

        var signals = new List<RawCameraDiscoverySignal>();

        var onvifSignals = await onvifTask;
        _logger?.LogInformation("ONVIF multicast discovery returned {CandidateCount} candidate(s).", onvifSignals.Count);
        signals.AddRange(onvifSignals);

        var configuredRtspSignals = await configuredRtspTask;
        _logger?.LogInformation("Configured RTSP discovery returned {CandidateCount} candidate(s).", configuredRtspSignals.Count);
        signals.AddRange(configuredRtspSignals);

        var configuredOnvifSignals = await configuredOnvifTask;
        _logger?.LogInformation("Configured ONVIF unicast discovery returned {CandidateCount} candidate(s).", configuredOnvifSignals.Count);
        signals.AddRange(configuredOnvifSignals);

        var configuredHttpSignals = await configuredHttpTask;
        _logger?.LogInformation("Configured HTTP discovery returned {CandidateCount} candidate(s).", configuredHttpSignals.Count);
        signals.AddRange(configuredHttpSignals);

        var hostnameSignals = await hostnameTask;
        _logger?.LogInformation("Hostname discovery returned {CandidateCount} candidate(s).", hostnameSignals.Count);
        signals.AddRange(hostnameSignals);

        var macSignals = await macTask;
        _logger?.LogInformation("MAC/OUI discovery returned {CandidateCount} candidate(s).", macSignals.Count);
        signals.AddRange(macSignals);

        return signals;
    }

    private static async Task<IReadOnlyList<RawCameraDiscoverySignal>> DiscoverOnvifSignalsAsync(CancellationToken ct)
    {
        var results = new List<RawCameraDiscoverySignal>();
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
            results.AddRange(ParseOnvifSignals(responseText));
        }

        return results;
    }

    private static IEnumerable<RawCameraDiscoverySignal> ParseOnvifSignals(string xml)
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

                yield return BuildRawSignal(
                    ToDisplayName(uri.Host),
                    uri.Host,
                    554,
                    "onvif",
                    null,
                    "onvif",
                    $"ONVIF device announced via {uri.Host}:{uri.Port}.",
                    null,
                    null,
                    ["onvif_detected"]);
            }
        }
    }

    private async Task<IReadOnlyList<RawCameraDiscoverySignal>> DiscoverConfiguredRtspSignalsAsync(IReadOnlyList<string> hosts, CancellationToken ct)
    {
        if (hosts.Count == 0)
        {
            return [];
        }
        //return [];

        var results = new List<RawCameraDiscoverySignal>();
        using var gate = new SemaphoreSlim(_settings.Discovery.MaxConcurrentProbes);

        var tasks = hosts
            .SelectMany(host => _settings.Discovery.RtspPorts.Select(port => ProbeConfiguredRtspHostAsync(host, port, gate, ct)))
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

    private async Task<IReadOnlyList<RawCameraDiscoverySignal>> DiscoverConfiguredHttpSignalsAsync(IReadOnlyList<string> hosts, CancellationToken ct)
    {
        if (hosts.Count == 0)
        {
            return [];
        }

        var results = new List<RawCameraDiscoverySignal>();
        using var gate = new SemaphoreSlim(_settings.Discovery.MaxConcurrentProbes);

        var tasks = hosts
            .SelectMany(host => _settings.Discovery.HttpPorts.Select(port => ProbeConfiguredHttpHostAsync(host, port, gate, ct)))
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

    private async Task<IReadOnlyList<RawCameraDiscoverySignal>> DiscoverConfiguredOnvifSignalsAsync(IReadOnlyList<string> hosts, CancellationToken ct)
    {
        if (hosts.Count == 0)
        {
            return [];
        }

        var results = new List<RawCameraDiscoverySignal>();
        using var gate = new SemaphoreSlim(_settings.Discovery.MaxConcurrentProbes);

        var tasks = hosts
            .SelectMany(host => _settings.Discovery.OnvifPorts.Select(port => ProbeConfiguredOnvifHostAsync(host, port, gate, ct)))
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

    private async Task<IReadOnlyList<RawCameraDiscoverySignal>> DiscoverMacVendorSignalsAsync(IReadOnlyList<string> hosts, CancellationToken ct)
    {
        if (hosts.Count == 0)
        {
            return [];
        }

        var results = new List<RawCameraDiscoverySignal>();

        foreach (var host in hosts)
        {
            ct.ThrowIfCancellationRequested();

            var macAddress = await ResolveMacAddressAsync(host, ct);
            if (string.IsNullOrWhiteSpace(macAddress) || !AssistedCameraDiscoveryKnownDevices.IsKnownMacVendor(macAddress))
            {
                continue;
            }

            results.Add(BuildRawSignal(
                ToDisplayName(host),
                host,
                0,
                "vendor_probe",
                null,
                "mac_vendor_probe",
                $"Equipement detecte via l'adresse MAC {macAddress}. Les services video ne repondent pas encore ou sont desactives.",
                macAddress,
                null,
                ["vendor_oui_match"]));

            _logger?.LogDebug("MAC/OUI candidate detected for host {Host}.", host);
        }

        return results;
    }

    private async Task<IReadOnlyList<RawCameraDiscoverySignal>> DiscoverHostnameSignalsAsync(IReadOnlyList<string> hosts, CancellationToken ct)
    {
        if (hosts.Count == 0)
        {
            return [];
        }

        var results = new List<RawCameraDiscoverySignal>();

        foreach (var host in hosts)
        {
            ct.ThrowIfCancellationRequested();

            var hostName = await ResolveHostNameAsync(host, ct);
            if (string.IsNullOrWhiteSpace(hostName) || !AssistedCameraDiscoveryKnownDevices.LooksLikeCameraHostName(hostName))
            {
                continue;
            }

            results.Add(BuildRawSignal(
                ToDisplayName(hostName),
                host,
                0,
                "vendor_probe",
                null,
                "hostname_probe",
                $"Le nom reseau {hostName} ressemble a une camera.",
                null,
                hostName,
                ["hostname_camera_hint"]));

            _logger?.LogDebug("Hostname candidate detected for host {Host} with hostname {HostName}.", host, hostName);
        }

        return results;
    }

    private async Task<RawCameraDiscoverySignal?> ProbeConfiguredRtspHostAsync(string host, int port, SemaphoreSlim gate, CancellationToken ct)
    {
        await gate.WaitAsync(ct);

        try
        {
            var streamPath = await ProbeRtspPathsAsync(host, port, _settings.Discovery.RtspPaths, _settings.Discovery.ProbeTimeoutMs, ct);
            if (!string.IsNullOrWhiteSpace(streamPath))
            {
                var macAddress = await ResolveMacAddressAsync(host, ct);
                return BuildRawSignal(
                    ToDisplayName(host),
                    host,
                    port,
                    "rtsp_manual",
                    streamPath,
                    "rtsp_describe",
                    $"RTSP repond sur {host}:{port} avec un chemin exploitable ({streamPath}).",
                    macAddress,
                    null,
                    ["rtsp_responding"]);
            }

            if (!await CanConnectAsync(host, port, _settings.Discovery.ProbeTimeoutMs, ct))
            {
                return null;
            }

            var fallbackMacAddress = await ResolveMacAddressAsync(host, ct);
            return BuildRawSignal(
                ToDisplayName(host),
                host,
                port,
                "rtsp_manual",
                null,
                "network_scan",
                $"RTSP port {port} responded during configured LAN scan. Complete the RTSP path before verification.",
                fallbackMacAddress,
                null,
                ["rtsp_responding"]);
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<RawCameraDiscoverySignal?> ProbeConfiguredOnvifHostAsync(string host, int port, SemaphoreSlim gate, CancellationToken ct)
    {
        await gate.WaitAsync(ct);

        try
        {
            var probe = await ProbeOnvifUnicastEndpointAsync(host, port, _settings.Discovery.ProbeTimeoutMs, ct);
            if (probe is null)
            {
                return null;
            }

            var macAddress = await ResolveMacAddressAsync(host, ct);
            return probe with { MacAddress = macAddress };
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<RawCameraDiscoverySignal?> ProbeConfiguredHttpHostAsync(string host, int port, SemaphoreSlim gate, CancellationToken ct)
    {
        await gate.WaitAsync(ct);

        try
        {
            var probe = await ProbeOnvifUnicastEndpointAsync(host, port, _settings.Discovery.ProbeTimeoutMs, ct)
                ?? await ProbeHttpEndpointAsync(host, port, _settings.Discovery.ProbeTimeoutMs, ct);

            if (probe is null)
            {
                return null;
            }

            var macAddress = await ResolveMacAddressAsync(host, ct);
            return probe with { MacAddress = macAddress };
        }
        finally
        {
            gate.Release();
        }
    }

    private IReadOnlyList<string> BuildConfiguredHostList()
    {
        var hosts = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var host in _settings.Discovery.ProbeHosts)
        {
            hosts.Add(host);
        }

        foreach (var cidr in _settings.Discovery.ProbeCidrs)
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

        if (_settings.Discovery.AutoDetectLocalCidrs)
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

    private static async Task<string?> ProbeRtspPathsAsync(string host, int port, IReadOnlyList<string> paths, int timeoutMs, CancellationToken ct)
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

    private static async Task<RawCameraDiscoverySignal?> ProbeHttpEndpointAsync(string host, int port, int timeoutMs, CancellationToken ct)
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

    private static async Task<RawCameraDiscoverySignal?> ProbeOnvifUnicastEndpointAsync(string host, int port, int timeoutMs, CancellationToken ct)
    {
        try
        {
            using var client = new TcpClient();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromMilliseconds(timeoutMs));

            await client.ConnectAsync(host, port, timeout.Token);

            using var stream = client.GetStream();
            var envelope = BuildOnvifGetCapabilitiesEnvelope();
            var request = $"POST /onvif/device_service HTTP/1.1\r\nHost: {host}\r\nContent-Type: application/soap+xml; charset=utf-8\r\nConnection: close\r\nUser-Agent: Vyzio\r\nContent-Length: {Encoding.UTF8.GetByteCount(envelope)}\r\n\r\n{envelope}";
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

            if (!LooksLikeOnvifUnicastResponse(response))
            {
                return null;
            }

            return BuildRawSignal(
                ToDisplayName(host),
                host,
                port,
                "onvif",
                null,
                "onvif_unicast",
                $"Endpoint ONVIF unicast detecte sur {host}:{port}. La camera peut etre integree meme sans interface web exploitable.",
                null,
                null,
                ["onvif_detected"]);
        }
        catch
        {
            return null;
        }
    }

    private static bool LooksLikeOnvifUnicastResponse(string response)
    {
        var normalized = response.ToLowerInvariant();
        var hasSoapEnvelope = normalized.Contains("application/soap+xml")
            || normalized.Contains("<s:envelope")
            || normalized.Contains("<soap:envelope")
            || normalized.Contains("<soap-env:envelope");

        var hasOnvifMarker = normalized.Contains("http://www.onvif.org/")
            || normalized.Contains("www.onvif.org/")
            || normalized.Contains("/onvif/device_service")
            || normalized.Contains("getcapabilitiesresponse")
            || normalized.Contains("getservicesresponse")
            || normalized.Contains("device_service")
            || normalized.Contains("trt:")
            || normalized.Contains("tds:")
            || normalized.Contains("realm=\"onvif\"")
            || normalized.Contains("realm='onvif'");

        return hasSoapEnvelope && hasOnvifMarker;
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

    private static RawCameraDiscoverySignal BuildHttpProbeResult(string host, int port, string response)
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
            return BuildRawSignal(
                "Camera TP-Link Tapo",
                host,
                port,
                "web_setup",
                null,
                "http_probe",
                $"Interface web TP-Link Tapo detectee sur {host}:{port}. RTSP et ONVIF sont souvent desactives d'origine et a activer dans l'application Tapo.",
                null,
                null,
                ["http_camera_signature"]);
        }

        if (fingerprint.Contains("onvif"))
        {
            return BuildRawSignal(
                title ?? ToDisplayName(host),
                host,
                port,
                "onvif",
                null,
                "http_probe",
                $"Service web camera detecte sur {host}:{port}. Un endpoint ONVIF semble present; finalisez ensuite l'activation video si necessaire.",
                null,
                null,
                ["onvif_detected"]);
        }

        if (LooksLikeCameraWebInterface(fingerprint, title, server))
        {
            return BuildRawSignal(
                title ?? ToDisplayName(host),
                host,
                port,
                "web_setup",
                null,
                "http_probe",
                $"Interface web camera detectee sur {host}:{port}. RTSP peut etre desactive d'origine; completez ensuite l'assistance de configuration.",
                null,
                null,
                ["http_camera_signature"]);
        }

        if (!string.IsNullOrWhiteSpace(server))
        {
            return BuildRawSignal(
                ToDisplayName(host),
                host,
                port,
                "web_setup",
                null,
                "http_service",
                $"Service web generique detecte sur {host}:{port} (serveur: {server}). Ce signal seul ne suffit pas a qualifier une camera.",
                null,
                null,
                ["http_service_detected"]);
        }

        if (!string.IsNullOrWhiteSpace(title))
        {
            return BuildRawSignal(
                title,
                host,
                port,
                "web_setup",
                null,
                "http_service",
                $"Service web generique detecte sur {host}:{port}. Ce signal seul ne suffit pas a qualifier une camera.",
                null,
                null,
                ["http_service_detected"]);
        }

        return BuildRawSignal(
            ToDisplayName(host),
            host,
            port,
            "web_setup",
            null,
            "http_service",
            $"Service web generique detecte sur {host}:{port}. Ce signal seul ne suffit pas a qualifier une camera.",
            null,
            null,
            ["http_service_detected"]);
    }

    private static RawCameraDiscoverySignal BuildRawSignal(
        string displayName,
        string host,
        int port,
        string sourceType,
        string? streamPath,
        string discoverySource,
        string? note,
        string? macAddress,
        string? resolvedHostName,
        IReadOnlyList<string> signals)
        => new(displayName, host, port, sourceType, streamPath, discoverySource, note, macAddress, resolvedHostName, signals);

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
}