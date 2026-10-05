using System.Buffers.Binary;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Configuration;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Infrastructure.Services.CameraDiscovery;

// ADR-32 — implements Stage 1 (identification, see IdentifyHostsAsync/PingSweepAsync) and
// Stage 2 (enrichment, see the Discover*SignalsAsync methods) of the discovery pipeline.
// Stage 3 (interpretation: qualification, vendor on a strong proof only) is deliberately not
// done here: it lives in AssistedCameraDiscoveryIdentifier/AssistedCameraDiscoveryFormatter, so
// this class only ever produces raw, structured facts (RawCameraDiscoverySignal), never a guess.
internal sealed class AssistedCameraDiscoveryProbePipeline
{
    private readonly ILogger? _logger;
    private readonly VyzioRuntimeSettings _settings;
    private readonly TimeProvider _time;

    public AssistedCameraDiscoveryProbePipeline(VyzioRuntimeSettings settings, TimeProvider time, ILogger? logger = null)
    {
        _settings = settings;
        _time = time;
        _logger = logger;
    }

    public async Task<IReadOnlyList<RawCameraDiscoverySignal>> DiscoverAsync(
        CameraDiscoveryTarget? target, IReadOnlyList<DiscoveryRange> ranges, CancellationToken ct)
    {
        if (target is not null)
        {
            return await DiscoverTargetAsync(target, ct);
        }

        _logger?.LogInformation(
            "Starting assisted camera discovery. ProbeHosts={ProbeHostsCount}, SweptRanges={SweptRanges}",
            _settings.Discovery.ProbeHosts.Count,
            string.Join(',', ranges.Select(range => $"{range.Cidr} ({range.Source})")));

        var configuredHosts = BuildConfiguredHostList(ranges);
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

        // Every identified host surfaces, at least as device_unknown; Stage 2 signals outrank it (ADR-32).
        var identificationSignals = identifiedHosts
            .Select(host => BuildRawSignal(
                ToDisplayName(host),
                host,
                0,
                "vendor_probe",
                null,
                "network_host",
                $"Hôte {host} présent sur le réseau (répond au ping) mais aucun protocole caméra connu identifié.",
                null,
                []))
            .ToList();

        // Stage 2 (ADR-32): the sweep finds ports and protocols, the probes add a path, a name and a ranking.
        var portScanTask = DiscoverPortScanSignalsAsync(identifiedHosts, ct);
        var configuredRtspTask = DiscoverConfiguredRtspSignalsAsync(identifiedHosts, RtspProbePorts, ct);
        var configuredHttpTask = DiscoverConfiguredHttpSignalsAsync(identifiedHosts, HttpProbePorts, ct);
        var hostnameTask = DiscoverHostnameSignalsAsync(identifiedHosts, ct);

        await Task.WhenAll(portScanTask, configuredRtspTask, configuredHttpTask, hostnameTask);

        var signals = new List<RawCameraDiscoverySignal>();
        signals.AddRange(identificationSignals);

        var portScanSignals = await portScanTask;
        _logger?.LogInformation("Port scan returned {CandidateCount} open-port signal(s).", portScanSignals.Count);
        signals.AddRange(portScanSignals);
        signals.AddRange(await configuredRtspTask);
        signals.AddRange(await configuredHttpTask);
        signals.AddRange(await hostnameTask);

        return signals;
    }

    // Port lists come from the internal catalog; test-only overrides can narrow them (see settings).
    private IReadOnlyList<int> RtspProbePorts => _settings.Discovery.RtspPortsOverride ?? DiscoveryPortCatalog.RtspProbePorts;
    private IReadOnlyList<int> HttpProbePorts => _settings.Discovery.HttpPortsOverride ?? DiscoveryPortCatalog.HttpProbePorts;

    // Same, for the port → fingerprint mapping: an override answers for the ports it names, and
    // leaves the others without any fingerprint to attempt (open, unidentified).
    private IReadOnlyList<DiscoveryPortCatalog.Fingerprint> FingerprintsForPort(int port)
    {
        if (_settings.Discovery.PortFingerprintsOverride is not { } overrides)
        {
            return DiscoveryPortCatalog.FingerprintsForPort(port);
        }

        return overrides.TryGetValue(port, out var protocol)
            ? [new DiscoveryPortCatalog.Fingerprint(protocol, DiscoveryPortCatalog.FormatProtocolLabel(protocol), [port])]
            : [];
    }

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

        await Task.WhenAll(portScanTask, configuredRtspTask, configuredHttpTask, hostnameTask);

        return (await portScanTask)
            .Concat(await configuredRtspTask)
            .Concat(await configuredHttpTask)
            .Concat(await hostnameTask)
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

            var confirmed = new List<DiscoveryPortCatalog.Fingerprint>();
            foreach (var fingerprint in FingerprintsForPort(port))
            {
                if (await ConfirmProtocolAsync(fingerprint.Protocol, host, port, ct))
                {
                    confirmed.Add(fingerprint);
                }
            }

            if (confirmed.Count > 0)
            {
                return confirmed
                    .Select(fingerprint => BuildPortSignal(host, port, fingerprint.Protocol, fingerprint.Label))
                    .ToList();
            }

            // Open but no protocol confirmed — still shown, labelled by convention or "unidentified".
            return [BuildPortSignal(host, port, protocol: null, DiscoveryPortCatalog.ServiceLabel(port))];
        }
        finally
        {
            gate.Release();
        }
    }

    private static RawCameraDiscoverySignal BuildPortSignal(
        string host, int port, SupportedProtocol? protocol, string serviceLabel)
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
            _ => false,
        };
    }

    // RTSP OPTIONS is path-agnostic: any RTSP server answers "RTSP/1.0 200"/"401" to it.
    private async Task<bool> FingerprintRtspAsync(string host, int port, int timeoutMs, CancellationToken ct)
    {
        try
        {
            using var client = new TcpClient();
            using var expiry = new CancellationTokenSource(TimeSpan.FromMilliseconds(timeoutMs), _time);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct, expiry.Token);
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
    private async Task<bool> FingerprintDvripAsync(string host, int port, int timeoutMs, CancellationToken ct)
    {
        try
        {
            using var client = new TcpClient();
            using var expiry = new CancellationTokenSource(TimeSpan.FromMilliseconds(timeoutMs), _time);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct, expiry.Token);
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

    // Only V380 firmware answers the credential-free auth frame with a full auth reply, hence the vendor (ADR-71).
    private async Task<bool> FingerprintV380Async(string host, int port, int timeoutMs, CancellationToken ct)
    {
        try
        {
            using var client = new TcpClient();
            using var expiry = new CancellationTokenSource(TimeSpan.FromMilliseconds(timeoutMs), _time);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct, expiry.Token);
            await client.ConnectAsync(host, port, timeout.Token);

            var packet = new byte[256];
            BinaryPrimitives.WriteInt32LittleEndian(packet, V380Client.AuthCommand);

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
            return total >= 256 && BinaryPrimitives.ReadInt32LittleEndian(buffer) == V380Client.AuthReplyCommand;
        }
        catch
        {
            return false;
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
                $"Le nom réseau {hostName} ressemble à une caméra.",
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

            return BuildRawSignal(
                ToDisplayName(host),
                host,
                port,
                "rtsp_manual",
                streamPath,
                "rtsp_describe",
                $"RTSP repond sur {host}:{port} avec un chemin exploitable ({streamPath}).",
                null,
                ["rtsp_responding", "rtsp_path_known"]);
        }
        finally
        {
            gate.Release();
        }
    }

    // HTTP probe: a name and the camera ranking, never the vendor (ADR-71); ONVIF is the sweep's job (ADR-32).
    private async Task<RawCameraDiscoverySignal?> ProbeConfiguredHttpHostAsync(string host, int port, SemaphoreSlim gate, CancellationToken ct)
    {
        await gate.WaitAsync(ct);

        try
        {
            return await ProbeHttpEndpointAsync(host, port, _settings.Discovery.ProbeTimeoutMs, ct);
        }
        finally
        {
            gate.Release();
        }
    }

    // ADR-32 — Stage 1 (identification) input: hosts named explicitly by configuration are never
    // gated behind a liveness check (the admin/user pointed at them directly), while CIDR-swept
    // hosts (auto-enumerated ranges) are numerous and unqualified — those go through the ping
    // sweep before anything else is attempted against them.
    private sealed record ConfiguredHosts(IReadOnlyList<string> Explicit, IReadOnlyList<string> Swept);

    private ConfiguredHosts BuildConfiguredHostList(IReadOnlyList<DiscoveryRange> ranges)
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

        var sweptHosts = ranges
            .SelectMany(DiscoveryRanges.Hosts)
            .Where(host => !explicitSeen.Contains(host))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new ConfiguredHosts(explicitHosts, sweptHosts);
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

    private async Task<bool> CanConnectAsync(string host, int port, int timeoutMs, CancellationToken ct)
    {
        try
        {
            using var client = new TcpClient();
            using var expiry = new CancellationTokenSource(TimeSpan.FromMilliseconds(timeoutMs), _time);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct, expiry.Token);
            await client.ConnectAsync(host, port, timeout.Token);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private async Task<string?> ProbeRtspPathsAsync(string host, int port, IReadOnlyList<string> paths, int timeoutMs, CancellationToken ct)
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

    private async Task<bool> CanDescribeRtspPathAsync(string host, int port, string path, int timeoutMs, CancellationToken ct)
    {
        try
        {
            using var client = new TcpClient();
            using var expiry = new CancellationTokenSource(TimeSpan.FromMilliseconds(timeoutMs), _time);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct, expiry.Token);

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

    private async Task<RawCameraDiscoverySignal?> ProbeHttpEndpointAsync(string host, int port, int timeoutMs, CancellationToken ct)
    {
        try
        {
            using var client = new TcpClient();
            using var expiry = new CancellationTokenSource(TimeSpan.FromMilliseconds(timeoutMs), _time);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct, expiry.Token);

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

    // Every candidate path: a single-endpoint firmware (Tapo) answers 404 on the common one (ADR-56).
    private async Task<RawCameraDiscoverySignal?> ProbeOnvifUnicastEndpointAsync(string host, int port, int timeoutMs, CancellationToken ct)
    {
        foreach (var path in DiscoveryPortCatalog.OnvifPaths)
        {
            if (await ProbeOnvifPathAsync(host, port, path, timeoutMs, ct) is { } signal)
                return signal;
        }

        return null;
    }

    private async Task<RawCameraDiscoverySignal?> ProbeOnvifPathAsync(string host, int port, string path, int timeoutMs, CancellationToken ct)
    {
        try
        {
            using var client = new TcpClient();
            using var expiry = new CancellationTokenSource(TimeSpan.FromMilliseconds(timeoutMs), _time);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct, expiry.Token);

            await client.ConnectAsync(host, port, timeout.Token);

            using var stream = client.GetStream();
            var envelope = OnvifServiceProbe.CredentialFreeEnvelope;
            var request = $"POST {path} HTTP/1.1\r\nHost: {host}\r\nContent-Type: application/soap+xml; charset=utf-8\r\nConnection: close\r\nUser-Agent: Vyzio\r\nContent-Length: {Encoding.UTF8.GetByteCount(envelope)}\r\n\r\n{envelope}";
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

            if (!OnvifServiceProbe.IdentifiesRawHttp(response))
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
                $"Endpoint ONVIF unicast détecté sur {host}:{port}. La caméra peut être intégrée même sans interface web exploitable.",
                null,
                ["onvif_detected"]);
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

        if (fingerprint.Contains("onvif"))
        {
            return BuildRawSignal(
                title ?? ToDisplayName(host),
                host,
                port,
                "onvif",
                null,
                "http_probe",
                $"Service web caméra détecté sur {host}:{port}. Un endpoint ONVIF semble présent; finalisez ensuite l'activation vidéo si nécessaire.",
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
                $"Interface web caméra détectée sur {host}:{port}. RTSP peut être désactivé d'origine; complétez ensuite l'assistance de configuration.",
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
                $"Service web générique détecté sur {host}:{port} (serveur: {server}). Ce signal seul ne suffit pas à qualifier une caméra.",
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
                $"Service web générique détecté sur {host}:{port}. Ce signal seul ne suffit pas à qualifier une caméra.",
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
            $"Service web générique détecté sur {host}:{port}. Ce signal seul ne suffit pas à qualifier une caméra.",
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
        string? resolvedHostName,
        IReadOnlyList<string> signals)
        => new(displayName, host, port, sourceType, streamPath, discoverySource, note, resolvedHostName, signals);

    private static string ToDisplayName(string host)
        => host.Replace('-', ' ').Replace('_', ' ');

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
            "tapo",
            "tp-link",
            "tplink",
        };

        return markers.Any(marker => combined.Contains(marker, StringComparison.OrdinalIgnoreCase));
    }
}
