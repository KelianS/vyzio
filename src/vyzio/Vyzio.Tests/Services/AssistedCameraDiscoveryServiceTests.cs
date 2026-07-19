using System.Net;
using System.Net.Sockets;
using System.Text;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Configuration;
using Vyzio.Infrastructure.Services;

namespace Vyzio.Tests.Services;

public class AssistedCameraDiscoveryServiceTests
{
    [Fact]
    public async Task DiscoverAsync_returns_candidate_from_configured_probe_host()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();

        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        using var stopServer = new CancellationTokenSource();
        var serverTask = RespondRtspOkAsync(listener, stopServer.Token);

        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["127.0.0.1"],
                RtspPortsOverride = [port],
                HttpPortsOverride = [],
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
                ScanPortsOverride = [],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();

        stopServer.Cancel();
        await serverTask;
        var candidate = Assert.Single(result, item => item.Host == "127.0.0.1" && item.Port == port);
        Assert.Equal("rtsp_describe", candidate.DiscoverySource);
        Assert.Equal("camera_confirmed", candidate.Qualification);
        Assert.Equal("unknown", candidate.SupportLevel);
        Assert.Contains("rtsp_responding", candidate.QualificationReasons);
        Assert.Equal("/stream1", candidate.StreamPath);
        Assert.Null(candidate.MacAddress);
        Assert.NotNull(candidate.TechnicalDetails);
        // The detected-ports table is sourced from the catalog port sweep (fixed ports), not from
        // the RTSP DESCRIBE probe's random test port — so it's the stream path that's asserted here.
        Assert.Equal(["/stream1"], candidate.TechnicalDetails!.RtspPathsDetected);
    }

    // CIDR enumeration reaches a live host, which is then enriched (here RTSP DESCRIBE finds a
    // usable path). 127.0.0.1/32 → 127.0.0.1, identified via ping (loopback).
    [Fact]
    public async Task DiscoverAsync_returns_candidate_from_configured_cidr()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        using var stopServer = new CancellationTokenSource();
        var serverTask = RespondRtspOkAsync(listener, stopServer.Token);

        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeCidrs = ["127.0.0.1/32"],
                RtspPortsOverride = [port],
                HttpPortsOverride = [],
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
                ScanPortsOverride = [],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();
        stopServer.Cancel();
        await serverTask;

        var candidate = Assert.Single(result, item => item.Host == "127.0.0.1" && item.Port == port);
        Assert.Equal("rtsp_describe", candidate.DiscoverySource);
        Assert.Equal("camera_confirmed", candidate.Qualification);
        Assert.Contains("rtsp_responding", candidate.QualificationReasons);
    }

    // Loop-accept helper: answers every request with an RTSP 200 (enough for DESCRIBE/OPTIONS).
    private static Task RespondRtspOkAsync(TcpListener listener, CancellationToken ct) => Task.Run(async () =>
    {
        try
        {
            while (!ct.IsCancellationRequested)
            {
                using var client = await listener.AcceptTcpClientAsync(ct);
                using var stream = client.GetStream();
                var buffer = new byte[1024];
                _ = await stream.ReadAsync(buffer, ct);
                var payload = "RTSP/1.0 200 OK\r\nCSeq: 1\r\nContent-Length: 0\r\n\r\n";
                await stream.WriteAsync(Encoding.ASCII.GetBytes(payload), ct);
                await stream.FlushAsync(ct);
            }
        }
        catch (OperationCanceledException) { }
        catch (System.Net.Sockets.SocketException) { }
    });

    // Loop-accept helper: answers every request with the given raw HTTP response.
    private static Task RespondHttpAsync(TcpListener listener, string response, CancellationToken ct) => Task.Run(async () =>
    {
        try
        {
            while (!ct.IsCancellationRequested)
            {
                using var client = await listener.AcceptTcpClientAsync(ct);
                using var stream = client.GetStream();
                var buffer = new byte[1024];
                _ = await stream.ReadAsync(buffer, ct);
                await stream.WriteAsync(Encoding.UTF8.GetBytes(response), ct);
                await stream.FlushAsync(ct);
            }
        }
        catch (OperationCanceledException) { }
        catch (System.Net.Sockets.SocketException) { }
    });

    [Fact]
    public async Task DiscoverAsync_returns_http_candidate_with_tapo_hint()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();

        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        using var stopServer = new CancellationTokenSource();
        var serverTask = RespondHttpAsync(
            listener,
            "HTTP/1.1 200 OK\r\nServer: TP-Link Tapo\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n<html><head><title>Tapo Camera</title></head><body>Tapo</body></html>",
            stopServer.Token);

        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["127.0.0.1"],
                RtspPortsOverride = [],
                HttpPortsOverride = [port],
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
                ScanPortsOverride = [],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();
        stopServer.Cancel();
        await serverTask;

        var candidate = Assert.Single(result, item => item.Host == "127.0.0.1" && item.Port == port);
        Assert.Equal("http_probe", candidate.DiscoverySource);
        Assert.Equal("web_setup", candidate.SourceType);
        Assert.Equal("camera_likely", candidate.Qualification);
        Assert.Equal("guided", candidate.SupportLevel);
        Assert.Equal("tplink_tapo", candidate.VendorFamily);
        Assert.Contains("http_camera_signature", candidate.QualificationReasons);
        Assert.Contains("Tapo", candidate.Note);
        Assert.Null(candidate.MacAddress);
    }

    [Fact]
    public async Task DiscoverAsync_returns_generic_http_service_as_device_unknown()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();

        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        using var stopServer = new CancellationTokenSource();
        var serverTask = RespondHttpAsync(
            listener,
            "HTTP/1.1 200 OK\r\nServer: nginx\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n<html><head><title>Admin Portal</title></head><body>hello</body></html>",
            stopServer.Token);

        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["127.0.0.1"],
                RtspPortsOverride = [],
                HttpPortsOverride = [port],
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
                ScanPortsOverride = [],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();
        stopServer.Cancel();
        await serverTask;

        var candidate = Assert.Single(result, item => item.Host == "127.0.0.1" && item.Port == port);
        Assert.Equal("http_service", candidate.DiscoverySource);
        Assert.Equal("device_unknown", candidate.Qualification);
        Assert.Contains("http_service_detected", candidate.QualificationReasons);
        Assert.DoesNotContain("http_camera_signature", candidate.QualificationReasons);
    }

    // ADR-32: ONVIF is detected by the port-sweep SOAP fingerprint on a catalog ONVIF port (here
    // 8899, common on V380/XM), regardless of any web UI. Confirms the protocol → ONVIF capability.
    [Fact]
    public async Task DiscoverAsync_confirms_onvif_via_fingerprint_on_catalog_port()
    {
        const int onvifPort = 8899;
        using var listener = new TcpListener(IPAddress.Loopback, onvifPort);
        listener.Start();
        using var stopServer = new CancellationTokenSource();
        var serverTask = RespondOnvifAsync(listener, stopServer.Token);

        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["127.0.0.1"],
                RtspPortsOverride = [],
                HttpPortsOverride = [],
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
                ScanPortsOverride = [onvifPort],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();
        stopServer.Cancel();
        await serverTask;

        var candidate = Assert.Single(result, item => item.Host == "127.0.0.1");
        Assert.Equal("camera_confirmed", candidate.Qualification);
        var port = Assert.Single(candidate.TechnicalDetails!.DetectedPorts);
        Assert.Equal(onvifPort, port.Port);
        Assert.Equal("Onvif", port.Protocol);
    }

    // Loop-accept helper answering only genuine ONVIF SOAP requests with a valid ONVIF reply.
    private static Task RespondOnvifAsync(TcpListener listener, CancellationToken ct) => Task.Run(async () =>
    {
        const string payload = "HTTP/1.1 200 OK\r\nContent-Type: application/soap+xml\r\nConnection: close\r\n\r\n<s:Envelope xmlns:s=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:tds=\"http://www.onvif.org/ver10/device/wsdl\"><s:Body><tds:GetCapabilitiesResponse/></s:Body></s:Envelope>";
        try
        {
            while (!ct.IsCancellationRequested)
            {
                using var client = await listener.AcceptTcpClientAsync(ct);
                using var stream = client.GetStream();
                var buffer = new byte[2048];
                var read = await stream.ReadAsync(buffer, ct);
                var request = Encoding.UTF8.GetString(buffer, 0, read);
                // Only answer the ONVIF probe (POST /onvif/device_service); ignore anything else.
                if (request.Contains("device_service", StringComparison.OrdinalIgnoreCase))
                {
                    await stream.WriteAsync(Encoding.UTF8.GetBytes(payload), ct);
                    await stream.FlushAsync(ct);
                }
            }
        }
        catch (OperationCanceledException) { }
        catch (System.Net.Sockets.SocketException) { }
    });

    // ADR-32: an identified host that matches no protocol/vendor signal no longer disappears —
    // it now surfaces as a device_unknown "network_host" baseline candidate (backlog: "show
    // everything found, even unmatched, at lower priority"). This replaces the old expectation
    // that a rejected SOAP gateway produced literally zero output.
    // A SOAP gateway with no ONVIF markers must NOT be confirmed as ONVIF: the fingerprint fails,
    // so the open catalog ONVIF port (8000) surfaces as an unidentified open port, device_unknown.
    [Fact]
    public async Task DiscoverAsync_does_not_treat_generic_soap_gateway_as_onvif_camera()
    {
        const int port = 8000;
        using var listener = new TcpListener(IPAddress.Loopback, port);
        listener.Start();
        using var stopServer = new CancellationTokenSource();
        var serverTask = Task.Run(async () =>
        {
            const string payload = "HTTP/1.1 401 Unauthorized\r\nContent-Type: application/soap+xml\r\nConnection: close\r\n\r\n<s:Envelope xmlns:s=\"http://www.w3.org/2003/05/soap-envelope\"><s:Body><s:Fault><s:Reason><s:Text xml:lang=\"en\">Unauthorized</s:Text></s:Reason></s:Fault></s:Body></s:Envelope>";
            try
            {
                while (!stopServer.IsCancellationRequested)
                {
                    using var client = await listener.AcceptTcpClientAsync(stopServer.Token);
                    using var stream = client.GetStream();
                    var buffer = new byte[2048];
                    _ = await stream.ReadAsync(buffer, stopServer.Token);
                    await stream.WriteAsync(Encoding.UTF8.GetBytes(payload), stopServer.Token);
                    await stream.FlushAsync(stopServer.Token);
                }
            }
            catch (OperationCanceledException) { }
            catch (System.Net.Sockets.SocketException) { }
        });

        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["127.0.0.1"],
                RtspPortsOverride = [],
                HttpPortsOverride = [],
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
                ScanPortsOverride = [port],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();
        stopServer.Cancel();
        await serverTask;

        var candidate = Assert.Single(result, item => item.Host == "127.0.0.1");
        Assert.Equal("device_unknown", candidate.Qualification);
        var detectedPort = Assert.Single(candidate.TechnicalDetails!.DetectedPorts);
        Assert.Equal("unknown", detectedPort.Protocol);
        Assert.DoesNotContain("onvif_detected", candidate.QualificationReasons);
    }

    [Fact]
    public async Task DiscoverAsync_returns_candidate_from_hostname_hint_when_ports_are_disabled()
    {
        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["c200-camera-tapo.lan"],
                RtspPortsOverride = [],
                HttpPortsOverride = [],
                ProbeTimeoutMs = 200,
                MaxConcurrentProbes = 1,
                ScanPortsOverride = [],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();

        var candidate = Assert.Single(result, item => item.Host == "c200-camera-tapo.lan");
        Assert.Equal("hostname_probe", candidate.DiscoverySource);
        Assert.Equal("camera_likely", candidate.Qualification);
        Assert.Equal("guided", candidate.SupportLevel);
        Assert.Equal("tplink_tapo", candidate.VendorFamily);
        Assert.Contains("hostname_camera_hint", candidate.QualificationReasons);
    }

    [Fact]
    public async Task DiscoverAsync_returns_v380_candidate_from_hostname_hint_when_ports_are_disabled()
    {
        var settings = new VyzioRuntimeSettings
        {
            Documentation = new VyzioRuntimeSettings.DocumentationSettings
            {
                VendorCatalogPath = FindRepoPath("src", "vyzio", "vendors")
            },
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["v380pro-camera.lan"],
                RtspPortsOverride = [],
                HttpPortsOverride = [],
                ProbeTimeoutMs = 200,
                MaxConcurrentProbes = 1,
                ScanPortsOverride = [],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();

        var candidate = Assert.Single(result, item => item.Host == "v380pro-camera.lan");
        Assert.Equal("hostname_probe", candidate.DiscoverySource);
        Assert.Equal("camera_likely", candidate.Qualification);
        Assert.Equal("guided", candidate.SupportLevel);
        Assert.Equal("v380_pro", candidate.VendorFamily);
        Assert.Contains("hostname_camera_hint", candidate.QualificationReasons);
        Assert.Contains("vendor_hint_detected", candidate.QualificationReasons);
        Assert.NotNull(candidate.VendorDocumentation);
        Assert.Contains("# V380 PRO", candidate.VendorDocumentation!.Markdown, StringComparison.Ordinal);
        Assert.Contains("https://gist.github.com/SolveSoul/9be5d9599c8b4b59f7cfa4cd0ce79c9c", candidate.VendorDocumentation.Markdown, StringComparison.Ordinal);
    }

    private static string FindRepoPath(params string[] parts)
    {
        var segments = new[] { AppContext.BaseDirectory, "..", "..", "..", "..", "..", ".." }
            .Concat(parts)
            .ToArray();

        return Path.GetFullPath(Path.Combine(segments));
    }

    [Fact]
    public async Task DiscoverAsync_returns_candidate_from_mv_hostname_prefix_when_ports_are_disabled()
    {
        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["MV26970853"],
                RtspPortsOverride = [],
                HttpPortsOverride = [],
                ProbeTimeoutMs = 200,
                MaxConcurrentProbes = 1,
                ScanPortsOverride = [],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();

        var candidate = Assert.Single(result, item => item.Host == "MV26970853");
        Assert.Equal("hostname_probe", candidate.DiscoverySource);
        Assert.Equal("camera_likely", candidate.Qualification);
        Assert.Contains("hostname_camera_hint", candidate.QualificationReasons);
    }

    [Fact]
    public async Task DiscoverAsync_merges_candidates_for_same_host_and_keeps_best_match()
    {
        using var rtspListener = new TcpListener(IPAddress.Loopback, 0);
        rtspListener.Start();
        using var httpListener = new TcpListener(IPAddress.Loopback, 0);
        httpListener.Start();

        var rtspPort = ((IPEndPoint)rtspListener.LocalEndpoint).Port;
        var httpPort = ((IPEndPoint)httpListener.LocalEndpoint).Port;
        using var stopServer = new CancellationTokenSource();

        var rtspServerTask = RespondRtspOkAsync(rtspListener, stopServer.Token);
        var httpServerTask = RespondHttpAsync(
            httpListener,
            "HTTP/1.1 200 OK\r\nServer: TP-Link Tapo\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n<html><head><title>Tapo Camera</title></head><body>Tapo</body></html>",
            stopServer.Token);

        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["127.0.0.1"],
                RtspPortsOverride = [rtspPort],
                HttpPortsOverride = [httpPort],
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
                ScanPortsOverride = [],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();

        stopServer.Cancel();
        await Task.WhenAll(rtspServerTask, httpServerTask);

        var candidate = Assert.Single(result);
        Assert.Equal("127.0.0.1", candidate.Host);
        Assert.Equal(rtspPort, candidate.Port);
        Assert.Equal("rtsp_describe", candidate.DiscoverySource);
        Assert.Equal("camera_confirmed", candidate.Qualification);
        Assert.Equal("tplink_tapo", candidate.VendorFamily);
        Assert.Contains("rtsp_responding", candidate.QualificationReasons);
        Assert.Contains("http_camera_signature", candidate.QualificationReasons);
        Assert.False(string.IsNullOrWhiteSpace(candidate.TechnicalDetails?.ResolvedHostName));
    }

    [Fact]
    public async Task DiscoverAsync_orders_best_matches_first()
    {
        using var rtspListener = new TcpListener(IPAddress.Loopback, 0);
        rtspListener.Start();

        var rtspPort = ((IPEndPoint)rtspListener.LocalEndpoint).Port;
        using var stopServer = new CancellationTokenSource();
        var rtspServerTask = RespondRtspOkAsync(rtspListener, stopServer.Token);

        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["127.0.0.1", "c200-camera-tapo.lan"],
                RtspPortsOverride = [rtspPort],
                HttpPortsOverride = [],
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
                ScanPortsOverride = [],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();

        stopServer.Cancel();
        await rtspServerTask;

        Assert.Equal(2, result.Count);
        Assert.Equal("127.0.0.1", result[0].Host);
        Assert.Equal("camera_confirmed", result[0].Qualification);
        Assert.Equal("c200-camera-tapo.lan", result[1].Host);
        Assert.Equal("camera_likely", result[1].Qualification);
    }

    // ADR-32: identification (Stage 1) is only a filter on what to enrich, never a filter on
    // what gets shown — a host with zero matching protocol/MAC/hostname signal must still surface
    // as device_unknown rather than vanish (this was the actual bug behind "plenty of devices are
    // still missing, not even shown as unidentified").
    [Fact]
    public async Task DiscoverAsync_returns_network_host_baseline_for_identified_host_with_no_matching_signal()
    {
        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["127.0.0.1"],
                RtspPortsOverride = [],
                HttpPortsOverride = [],
                ProbeTimeoutMs = 200,
                MaxConcurrentProbes = 1,
                ScanPortsOverride = [],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();

        var candidate = Assert.Single(result, item => item.Host == "127.0.0.1");
        Assert.Equal("network_host", candidate.DiscoverySource);
        Assert.Equal("device_unknown", candidate.Qualification);
        Assert.Empty(candidate.QualificationReasons);
    }

    // A baseline network_host signal must never win a merge against a real detection for the
    // same host, however weak that detection is (regression guard for the priority ordering bug
    // found while implementing the fix above).
    [Fact]
    public async Task DiscoverAsync_network_host_baseline_never_overrides_a_real_signal_for_same_host()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();

        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        using var stopServer = new CancellationTokenSource();
        var serverTask = Task.Run(async () =>
        {
            try
            {
                while (!stopServer.IsCancellationRequested)
                {
                    using var client = await listener.AcceptTcpClientAsync(stopServer.Token);
                    using var stream = client.GetStream();
                    var buffer = new byte[1024];
                    _ = await stream.ReadAsync(buffer, stopServer.Token);

                    var payload = "HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n";
                    var bytes = Encoding.UTF8.GetBytes(payload);
                    await stream.WriteAsync(bytes, stopServer.Token);
                    await stream.FlushAsync(stopServer.Token);
                }
            }
            catch (OperationCanceledException) { }
        });

        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["127.0.0.1"],
                RtspPortsOverride = [],
                HttpPortsOverride = [port],
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
                ScanPortsOverride = [],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();
        stopServer.Cancel();
        await serverTask;

        var candidate = Assert.Single(result, item => item.Host == "127.0.0.1" && item.Port == port);
        Assert.Equal("http_service", candidate.DiscoverySource);
    }

    // ADR-32: the "nmap" port sweep + fingerprint. An open catalog port (34567 = DVRIP) that
    // passes the DVRIP fingerprint (0xFF magic reply) surfaces the host as a confirmed camera with
    // a Port|Protocol enrichment row. Same mechanism that lets V380 be detected on 8800 TCP.
    [Fact]
    public async Task DiscoverAsync_port_sweep_confirms_camera_from_fingerprinted_port()
    {
        const int dvripPort = 34567;
        using var listener = new TcpListener(IPAddress.Loopback, dvripPort);
        listener.Start();
        using var stopServer = new CancellationTokenSource();
        var serverTask = Task.Run(async () =>
        {
            try
            {
                while (!stopServer.IsCancellationRequested)
                {
                    using var client = await listener.AcceptTcpClientAsync(stopServer.Token);
                    using var stream = client.GetStream();
                    var buffer = new byte[128];
                    _ = await stream.ReadAsync(buffer, stopServer.Token);
                    // DVRIP fingerprint only checks the first byte is the 0xFF magic.
                    await stream.WriteAsync(new byte[] { 0xFF, 0x01, 0x00, 0x00 }, stopServer.Token);
                    await stream.FlushAsync(stopServer.Token);
                }
            }
            catch (OperationCanceledException) { }
            catch (System.Net.Sockets.SocketException) { }
        });

        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["127.0.0.1"],
                RtspPortsOverride = [],
                HttpPortsOverride = [],
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
                ScanPortsOverride = [dvripPort],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();
        stopServer.Cancel();
        await serverTask;

        var candidate = Assert.Single(result, item => item.Host == "127.0.0.1");
        Assert.Equal("camera_confirmed", candidate.Qualification);
        var port = Assert.Single(candidate.TechnicalDetails!.DetectedPorts);
        Assert.Equal(dvripPort, port.Port);
        Assert.Equal("DVRIP", port.Label);
        Assert.Equal("Dvrip", port.Protocol);
    }

    // ADR-32: an open port whose fingerprint fails (or has none) is NOT mislabelled — it surfaces
    // as an "unidentified open port" (this is the Tapo:8800-isn't-V380 fix). Here a dumb listener
    // on 8800 never completes the V380 handshake, so it must show up unidentified, not as V380.
    [Fact]
    public async Task DiscoverAsync_port_sweep_shows_unidentified_open_port_when_fingerprint_fails()
    {
        const int v380Port = 8800;
        using var listener = new TcpListener(IPAddress.Loopback, v380Port);
        listener.Start();
        using var stopServer = new CancellationTokenSource();
        var serverTask = Task.Run(async () =>
        {
            try
            {
                while (!stopServer.IsCancellationRequested)
                {
                    // Accept and immediately close — never speaks V380.
                    using var client = await listener.AcceptTcpClientAsync(stopServer.Token);
                }
            }
            catch (OperationCanceledException) { }
            catch (System.Net.Sockets.SocketException) { }
        });

        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["127.0.0.1"],
                RtspPortsOverride = [],
                HttpPortsOverride = [],
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
                ScanPortsOverride = [v380Port],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();
        stopServer.Cancel();
        await serverTask;

        var candidate = Assert.Single(result, item => item.Host == "127.0.0.1");
        var port = Assert.Single(candidate.TechnicalDetails!.DetectedPorts);
        Assert.Equal(v380Port, port.Port);
        Assert.Equal("unknown", port.Protocol);
        Assert.Equal("non identifié", port.Label);
        // No protocol confirmed → not a camera.
        Assert.Equal("device_unknown", candidate.Qualification);
    }
}