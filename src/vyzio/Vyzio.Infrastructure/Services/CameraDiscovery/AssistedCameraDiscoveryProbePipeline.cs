using System.Buffers.Binary;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Configuration;

namespace Vyzio.Infrastructure.Services.CameraDiscovery;

// ADR-32 — implements Stage 1 (identification, see IdentifyHostsAsync/PingSweepAsync) and
// Stage 2 (enrichment, see the Discover*SignalsAsync methods) of the discovery pipeline.
// Stage 3 (interpretation — vendor family, qualification, support level) is deliberately not
// done here: it lives in AssistedCameraDiscoveryIdentifier/AssistedCameraDiscoveryFormatter, so
// this class only ever produces raw, structured facts (RawCameraDiscoverySignal), never a guess.
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

    public async Task<IReadOnlyList<RawCameraDiscoverySignal>> DiscoverAsync(CameraDiscoveryTarget? target, CancellationToken ct)
    {
        if (target is not null)
        {
            return await DiscoverTargetAsync(target, ct);
        }

        _logger?.LogInformation(
            "Starting assisted camera discovery. AutoDetectLocalCidrs={AutoDetectLocalCidrs}, ProbeHosts={ProbeHostsCount}, ProbeCidrs={ProbeCidrsCount}",
            _settings.Discovery.AutoDetectLocalCidrs,
            _settings.Discovery.ProbeHosts.Count,
            _settings.Discovery.ProbeCidrs.Count);

        var configuredHosts = BuildConfiguredHostList();
        _logger?.LogInformation(
            "Built configured discovery host list: {ExplicitCount} explicit, {SweptCount} swept (CIDR).",
            configuredHosts.Explicit.Count,
            configuredHosts.Swept.Count);

        // Stage 1 — Identification: which hosts are worth enriching at all (see IdentifyHostsAsync).
        var identifiedHosts = await IdentifyHostsAsync(configuredHosts, ct);
        _logger?.LogInformation(
            "Stage 1 (identification) resolved {IdentifiedCount} host(s) to enrich: {IdentifiedHosts}",
            identifiedHosts.Count,
            string.Join(',', identifiedHosts));

        // ADR-32 correction: identification is a filter on what to enrich, never a filter on what
        // gets shown. Without this, a host that answers the ping but matches none of Stage 2's
        // protocols/MAC-OUI/hostname patterns produced zero signals and vanished entirely — the
        // exact "device found but not recognized" case the backlog asked to keep visible. This
        // baseline signal guarantees every identified host surfaces at least as device_unknown;
        // Stage 2 signals for the same host (if any) simply outrank it during the Formatter merge.
        var identificationSignals = identifiedHosts
            .Select(host => BuildRawSignal(
                ToDisplayName(host),
                host,
                0,
                "vendor_probe",
                null,
                "network_host",
                $"Hote {host} present sur le reseau (repond au ping) mais aucun protocole camera connu ni indice constructeur identifie.",
                null,
                null,
                []))
            .ToList();

        // Stage 2 — Enrichment (ADR-32). The TCP port sweep + fingerprint is the single source of
        // open ports and protocol detection (ONVIF/V380/DVRIP/RTSP/KLAP). The follow-up probes only
        // add what an open port can't give: RTSP DESCRIBE → stream path, HTTP → vendor hint, ONVIF
        // multicast → self-announced hostname. Ports come from the internal catalog, not settings.
        var portScanTask = DiscoverPortScanSignalsAsync(identifiedHosts, ct);
        var onvifTask = DiscoverOnvifSignalsAsync(ct);
        var configuredRtspTask = DiscoverConfiguredRtspSignalsAsync(identifiedHosts, RtspProbePorts, ct);
        var configuredHttpTask = DiscoverConfiguredHttpSignalsAsync(identifiedHosts, HttpProbePorts, ct);
        var hostnameTask = DiscoverHostnameSignalsAsync(identifiedHosts, ct);
        var macTask = DiscoverMacVendorSignalsAsync(identifiedHosts, ct);

        await Task.WhenAll(portScanTask, onvifTask, configuredRtspTask, configuredHttpTask, hostnameTask, macTask);

        var signals = new List<RawCameraDiscoverySignal>();
        signals.AddRange(identificationSignals);

        var portScanSignals = await portScanTask;
        _logger?.LogInformation("Port scan returned {CandidateCount} open-port signal(s).", portScanSignals.Count);
        signals.AddRange(portScanSignals);
        signals.AddRange(await onvifTask);
        signals.AddRange(await configuredRtspTask);
        signals.AddRange(await configuredHttpTask);
        signals.AddRange(await hostnameTask);
        signals.AddRange(await macTask);

        return signals;
    }

    // Port lists come from the internal catalog; test-only overrides can narrow them (see settings).
    private IReadOnlyList<int> RtspProbePorts => _settings.Discovery.RtspPortsOverride ?? DiscoveryPortCatalog.RtspProbePorts;
    private IReadOnlyList<int> HttpProbePorts => _settings.Discovery.HttpPortsOverride ?? DiscoveryPortCatalog.HttpProbePorts;

    // A single named target (e.g. "verify this host" from the manual-add form) is always
    // enriched directly — Stage 1 (identification) only exists to filter down a blind CIDR
    // sweep, and never applies to a host the user pointed at explicitly.
    private async Task<IReadOnlyList<RawCameraDiscoverySignal>> DiscoverTargetAsync(CameraDiscoveryTarget target, CancellationToken ct)
    {
        var hosts = new[] { target.Host.Trim() };
        // A user-supplied target port is worth DESCRIBE-ing for a stream path on top of the catalog.
        var rtspPorts = target.Port is > 0
            ? RtspProbePorts.Append(target.Port.Value).Distinct().Order().ToArray()
            : RtspProbePorts;

        var portScanTask = DiscoverPortScanSignalsAsync(hosts, ct);
        var configuredRtspTask = DiscoverConfiguredRtspSignalsAsync(hosts, rtspPorts, ct);
        var configuredHttpTask = DiscoverConfiguredHttpSignalsAsync(hosts, HttpProbePorts, ct);
        var hostnameTask = DiscoverHostnameSignalsAsync(hosts, ct);
        var macTask = DiscoverMacVendorSignalsAsync(hosts, ct);

        await Task.WhenAll(portScanTask, configuredRtspTask, configuredHttpTask, hostnameTask, macTask);

        return (await portScanTask)
            .Concat(await configuredRtspTask)
            .Concat(await configuredHttpTask)
            .Concat(await hostnameTask)
            .Concat(await macTask)
            .ToList();
    }

    // ADR-32 — the "nmap" stage: TCP-connect every port in DiscoveryPortCatalog on each host. An
    // open port is a fact; what it means comes from the catalog. Camera-signal ports (unique to a
    // camera protocol) also emit a qualification reason so the host is confirmed as a camera, plus
    // a protocol-specific reason kept for any downstream consumer (e.g. the DVRIP fallback UI).
    private async Task<IReadOnlyList<RawCameraDiscoverySignal>> DiscoverPortScanSignalsAsync(IReadOnlyList<string> hosts, CancellationToken ct)
    {
        // null → sweep the full catalog (production); [] → disabled; explicit list → test override.
        var scanPorts = _settings.Discovery.ScanPortsOverride ?? DiscoveryPortCatalog.Ports;

        if (hosts.Count == 0 || scanPorts.Count == 0)
        {
            return [];
        }

        using var gate = new SemaphoreSlim(_settings.Discovery.MaxConcurrentProbes);

        var tasks =
            from host in hosts
            from port in scanPorts
            select ScanPortAsync(host, port, gate, ct);

        var probed = await Task.WhenAll(tasks);
        return probed.SelectMany(signals => signals).ToList();
    }

    // For one open port: attempt every protocol fingerprint that may live there. A confirmed
    // fingerprint yields an authoritative protocol signal (camera-confirming); an open port that
    // confirms nothing still surfaces as an "unidentified open port" signal (with its conventional
    // service name if any) so it's shown to the user — never silently dropped.
    private async Task<IReadOnlyList<RawCameraDiscoverySignal>> ScanPortAsync(
        string host, int port, SemaphoreSlim gate, CancellationToken ct)
    {
        await gate.WaitAsync(ct);
        try
        {
            if (!await CanConnectAsync(host, port, _settings.Discovery.ProbeTimeoutMs, ct))
            {
                return [];
            }

            var macAddress = await ResolveMacAddressAsync(host, ct);
            var confirmed = new List<DiscoveryPortCatalog.Fingerprint>();
            foreach (var fingerprint in DiscoveryPortCatalog.FingerprintsForPort(port))
            {
                if (await ConfirmProtocolAsync(fingerprint.Protocol, host, port, ct))
                {
                    confirmed.Add(fingerprint);
                }
            }

            if (confirmed.Count > 0)
            {
                return confirmed
                    .Select(fingerprint => BuildPortSignal(host, port, macAddress, fingerprint.Protocol, fingerprint.Label))
                    .ToList();
            }

            // Open but no protocol confirmed — still shown, labelled by convention or "unidentified".
            return [BuildPortSignal(host, port, macAddress, protocol: null, DiscoveryPortCatalog.ServiceLabel(port))];
        }
        finally
        {
            gate.Release();
        }
    }

    private RawCameraDiscoverySignal BuildPortSignal(
        string host, int port, string? macAddress, SupportedProtocol? protocol, string serviceLabel)
    {
        var reasons = protocol is { } p
            ? new List<string> { "camera_port_open", $"{p.ToString().ToLowerInvariant()}_port_detected" }
            : [];

        var displayLabel = protocol is { } proto ? DiscoveryPortCatalog.FormatProtocolLabel(proto)
            : string.IsNullOrEmpty(serviceLabel) ? "non identifié" : serviceLabel;

        return new RawCameraDiscoverySignal(
            ToDisplayName(host),
            host,
            port,
            "rtsp_manual",
            null,
            "port_scan",
            $"Port {port} ({displayLabel}) ouvert sur {host}.",
            macAddress,
            null,
            reasons,
            ConfirmedProtocol: protocol,
            PortServiceLabel: protocol is null ? serviceLabel : null);
    }

    // Dispatches to the protocol-specific fingerprint (ADR-32 correction h). Each is a lightweight,
    // credential-free handshake that confirms the protocol actually speaks on the open port.
    private async Task<bool> ConfirmProtocolAsync(SupportedProtocol protocol, string host, int port, CancellationToken ct)
    {
        var timeout = _settings.Discovery.ProbeTimeoutMs;
        return protocol switch
        {
            SupportedProtocol.Rtsp => await FingerprintRtspAsync(host, port, timeout, ct),
            SupportedProtocol.Onvif => await ProbeOnvifUnicastEndpointAsync(host, port, timeout, ct) is not null,
            SupportedProtocol.Dvrip => await FingerprintDvripAsync(host, port, timeout, ct),
            SupportedProtocol.V380 => await FingerprintV380Async(host, port, timeout, ct),
            SupportedProtocol.TapoKlap => await ProbeTapoKlapEndpointAsync(host, port, timeout, ct) is not null,
            _ => false,
        };
    }

    // RTSP OPTIONS is path-agnostic: any RTSP server answers "RTSP/1.0 200"/"401" to it.
    private static async Task<bool> FingerprintRtspAsync(string host, int port, int timeoutMs, CancellationToken ct)
    {
        try
        {
            using var client = new TcpClient();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromMilliseconds(timeoutMs));
            await client.ConnectAsync(host, port, timeout.Token);

            using var stream = client.GetStream();
            var request = $"OPTIONS rtsp://{host}:{port} RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: Vyzio\r\n\r\n";
            await stream.WriteAsync(Encoding.ASCII.GetBytes(request), timeout.Token);
            await stream.FlushAsync(timeout.Token);

            var buffer = new byte[512];
            var read = await stream.ReadAsync(buffer, timeout.Token);
            return read > 0 && Encoding.ASCII.GetString(buffer, 0, read).StartsWith("RTSP/", StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    // DVRIP/XMEye: every response starts with the 0xFF magic byte (ADR-29).
    private static async Task<bool> FingerprintDvripAsync(string host, int port, int timeoutMs, CancellationToken ct)
    {
        try
        {
            using var client = new TcpClient();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromMilliseconds(timeoutMs));
            await client.ConnectAsync(host, port, timeout.Token);

            using var stream = client.GetStream();
            await stream.WriteAsync(BuildDvripProbePacket(), timeout.Token);
            await stream.FlushAsync(timeout.Token);

            var buffer = new byte[64];
            var read = await stream.ReadAsync(buffer, timeout.Token);
            return read >= 1 && buffer[0] == 0xFF;
        }
        catch
        {
            return false;
        }
    }

    private static byte[] BuildDvripProbePacket()
    {
        var json = Encoding.UTF8.GetBytes("{\"EncryptType\":\"MD5\",\"LoginType\":\"DVRIP\",\"PassWord\":\"tlJwpbo6\",\"UserName\":\"admin\"}");
        var packet = new byte[20 + json.Length];
        packet[0] = 0xFF; // magic
        packet[1] = 0x01; // version
        packet[14] = 0xE8; packet[15] = 0x03; // msgId 1000 LE
        packet[16] = (byte)(json.Length & 0xFF);
        packet[17] = (byte)(json.Length >> 8);
        Buffer.BlockCopy(json, 0, packet, 20, json.Length);
        return packet;
    }

    // V380 native (port 8800): send the cmd-1167 auth packet (256-byte frame, deviceId 0) and
    // require a full 256-byte V380-shaped reply. A non-V380 service on 8800 (e.g. a Tapo) won't
    // return that framed response, so it is not mislabelled V380. Best-effort but credential-free.
    private static async Task<bool> FingerprintV380Async(string host, int port, int timeoutMs, CancellationToken ct)
    {
        try
        {
            using var client = new TcpClient();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromMilliseconds(timeoutMs));
            await client.ConnectAsync(host, port, timeout.Token);

            var packet = new byte[256];
            BinaryPrimitives.WriteInt32LittleEndian(packet, 1167);

            using var stream = client.GetStream();
            await stream.WriteAsync(packet, timeout.Token);
            await stream.FlushAsync(timeout.Token);

            var total = 0;
            var buffer = new byte[256];
            while (total < 256)
            {
                var read = await stream.ReadAsync(buffer.AsMemory(total), timeout.Token);
                if (read == 0)
                {
                    break;
                }
                total += read;
            }
            return total >= 256;
        }
        catch
        {
            return false;
        }
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

    private async Task<IReadOnlyList<RawCameraDiscoverySignal>> DiscoverConfiguredRtspSignalsAsync(IReadOnlyList<string> hosts, IReadOnlyList<int> ports, CancellationToken ct)
    {
        if (hosts.Count == 0)
        {
            return [];
        }
        //return [];

        var results = new List<RawCameraDiscoverySignal>();
        using var gate = new SemaphoreSlim(_settings.Discovery.MaxConcurrentProbes);

        var tasks = hosts
            .SelectMany(host => ports.Select(port => ProbeConfiguredRtspHostAsync(host, port, gate, ct)))
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

    private async Task<IReadOnlyList<RawCameraDiscoverySignal>> DiscoverConfiguredHttpSignalsAsync(IReadOnlyList<string> hosts, IReadOnlyList<int> ports, CancellationToken ct)
    {
        if (hosts.Count == 0)
        {
            return [];
        }

        var results = new List<RawCameraDiscoverySignal>();
        using var gate = new SemaphoreSlim(_settings.Discovery.MaxConcurrentProbes);

        var tasks = hosts
            .SelectMany(host => ports.Select(port => ProbeConfiguredHttpHostAsync(host, port, gate, ct)))
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
            if (string.IsNullOrWhiteSpace(macAddress))
            {
                continue;
            }

            // ADR-31c: a host present in the ARP table but matching no known protocol/OUI/hostname
            // pattern must still surface (low priority, device_unknown) rather than disappear —
            // otherwise an unrecognized camera with no locally-exposed protocol (e.g. cloud-only
            // firmware) is invisible even though it is genuinely reachable on the LAN.
            var isKnownVendor = AssistedCameraDiscoveryKnownDevices.IsKnownMacVendor(macAddress);
            results.Add(BuildRawSignal(
                ToDisplayName(host),
                host,
                0,
                "vendor_probe",
                null,
                "mac_vendor_probe",
                isKnownVendor
                    ? $"Equipement detecte via l'adresse MAC {macAddress}. Les services video ne repondent pas encore ou sont desactives."
                    : $"Equipement present sur le reseau ({macAddress}) mais aucun protocole camera connu n'a repondu (RTSP/ONVIF/HTTP/DVRIP/V380/Tapo KLAP). Verifiez que l'acces local est active sur l'appareil, ou declarez-le manuellement.",
                macAddress,
                null,
                isKnownVendor ? ["vendor_oui_match"] : []));

            _logger?.LogDebug(
                "MAC-visible host {Host} ({VendorState}).", host, isKnownVendor ? "known vendor" : "unrecognized");
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
            // Only value-add here is the real stream path; "port 554 open" is already the sweep's
            // job (ADR-32), so an open RTSP port without a usable path produces no signal here.
            var streamPath = await ProbeRtspPathsAsync(host, port, DiscoveryPortCatalog.RtspPaths, _settings.Discovery.ProbeTimeoutMs, ct);
            if (string.IsNullOrWhiteSpace(streamPath))
            {
                return null;
            }

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
                ["rtsp_responding", "rtsp_path_known"]);
        }
        finally
        {
            gate.Release();
        }
    }

    // HTTP probe = vendor hint only (title/Server → brand). ONVIF on this port is handled by the
    // port-sweep fingerprint, not here (ADR-32 correction i).
    private async Task<RawCameraDiscoverySignal?> ProbeConfiguredHttpHostAsync(string host, int port, SemaphoreSlim gate, CancellationToken ct)
    {
        await gate.WaitAsync(ct);

        try
        {
            var probe = await ProbeHttpEndpointAsync(host, port, _settings.Discovery.ProbeTimeoutMs, ct);

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

    // ADR-31: KLAP handshake1 requires no credentials (only handshake2 does), so a positive reply
    // is a genuine protocol-level signal. Used by the port-sweep Tapo KLAP fingerprint (ADR-32) —
    // KLAP shares port 80 with generic HTTP, so only this handshake distinguishes it.
    private static async Task<RawCameraDiscoverySignal?> ProbeTapoKlapEndpointAsync(string host, int port, int timeoutMs, CancellationToken ct)
    {
        try
        {
            using var client = new TcpClient();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromMilliseconds(timeoutMs));

            await client.ConnectAsync(host, port, timeout.Token);

            var seed = System.Security.Cryptography.RandomNumberGenerator.GetBytes(16);
            var body = $"POST /app/handshake1 HTTP/1.1\r\nHost: {host}\r\nContent-Type: application/octet-stream\r\nContent-Length: {seed.Length}\r\nConnection: close\r\n\r\n";
            var header = Encoding.ASCII.GetBytes(body);

            using var stream = client.GetStream();
            await stream.WriteAsync(header, timeout.Token);
            await stream.WriteAsync(seed, timeout.Token);
            await stream.FlushAsync(timeout.Token);

            var buffer = new byte[512];
            var read = await stream.ReadAsync(buffer, timeout.Token);
            var response = Encoding.UTF8.GetString(buffer, 0, read);

            if (!response.StartsWith("HTTP/", StringComparison.OrdinalIgnoreCase) || !response.Contains(" 200"))
            {
                return null;
            }

            // Body must carry the 16-byte server seed + 32-byte server hash (KLAP handshake1 reply).
            var bodyStart = response.IndexOf("\r\n\r\n", StringComparison.Ordinal);
            var bodyLength = bodyStart >= 0 ? read - (bodyStart + 4) : 0;
            if (bodyLength < 48)
            {
                return null;
            }

            var macAddress = await ResolveMacAddressAsync(host, ct);
            return BuildRawSignal(
                ToDisplayName(host),
                host,
                port,
                "rtsp_manual",
                null,
                "tapo_klap_probe",
                $"Protocole Tapo KLAP detecte sur {host}:{port}. Utilise par les cameras TP-Link Tapo (pilotage local).",
                macAddress,
                null,
                ["tapo_klap_detected"]);
        }
        catch
        {
            return null;
        }
    }

    // ADR-32 — Stage 1 (identification) input: hosts named explicitly by configuration are never
    // gated behind a liveness check (the admin/user pointed at them directly), while CIDR-swept
    // hosts (auto-enumerated ranges) are numerous and unqualified — those go through the ping
    // sweep before anything else is attempted against them.
    private sealed record ConfiguredHosts(IReadOnlyList<string> Explicit, IReadOnlyList<string> Swept);

    private ConfiguredHosts BuildConfiguredHostList()
    {
        var explicitHosts = new List<string>();
        var explicitSeen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var host in _settings.Discovery.ProbeHosts)
        {
            if (explicitSeen.Add(host))
            {
                explicitHosts.Add(host);
            }
        }

        var sweptHosts = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void AddSweptHosts(IEnumerable<string> cidrs)
        {
            foreach (var cidr in cidrs)
            {
                foreach (var host in EnumerateHosts(cidr))
                {
                    if (explicitSeen.Count + sweptHosts.Count >= MaxConfiguredProbeHosts)
                    {
                        return;
                    }

                    if (!explicitSeen.Contains(host))
                    {
                        sweptHosts.Add(host);
                    }
                }
            }
        }

        AddSweptHosts(_settings.Discovery.ProbeCidrs);

        if (_settings.Discovery.AutoDetectLocalCidrs)
        {
            AddSweptHosts(DetectLocalCidrs());
        }

        return new ConfiguredHosts(explicitHosts, sweptHosts.ToList());
    }

    // ADR-32 — Stage 1 (identification): decide which hosts are worth enriching at all, before
    // any protocol-specific probe runs. Explicit hosts always pass through. Swept (CIDR) hosts
    // are filtered by an ICMP ping first — trying every protocol probe against every address in
    // a /24 is wasteful, and a ping reply is enough evidence a host exists to justify enriching it.
    private async Task<IReadOnlyList<string>> IdentifyHostsAsync(ConfiguredHosts configured, CancellationToken ct)
    {
        var liveSwept = await PingSweepAsync(configured.Swept, ct);

        // Safety net: if every swept host failed to answer, ICMP is more likely blocked/
        // unavailable in this deployment (e.g. a container without CAP_NET_RAW) than "no device
        // exists" on the whole range — fall back to the unfiltered list so a broken ping sweep
        // never regresses below the previous, unfiltered coverage.
        var effectiveSwept = liveSwept.Count == 0 && configured.Swept.Count > 0 ? configured.Swept : liveSwept;

        return configured.Explicit
            .Concat(effectiveSwept)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private async Task<IReadOnlyList<string>> PingSweepAsync(IReadOnlyList<string> hosts, CancellationToken ct)
    {
        if (hosts.Count == 0)
        {
            return [];
        }

        using var gate = new SemaphoreSlim(_settings.Discovery.MaxConcurrentProbes);
        var tasks = hosts.Select(host => PingHostAsync(host, gate, ct)).ToArray();
        var results = await Task.WhenAll(tasks);
        return results.Where(host => host is not null).Select(host => host!).ToList();
    }

    private async Task<string?> PingHostAsync(string host, SemaphoreSlim gate, CancellationToken ct)
    {
        await gate.WaitAsync(ct);
        try
        {
            using var ping = new Ping();
            var reply = await ping.SendPingAsync(host, _settings.Discovery.ProbeTimeoutMs);
            return reply.Status == IPStatus.Success ? host : null;
        }
        catch
        {
            return null;
        }
        finally
        {
            gate.Release();
        }
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
            "axis",
            "icsee",
            "xmeye",
        };

        return markers.Any(marker => combined.Contains(marker, StringComparison.OrdinalIgnoreCase));
    }
}