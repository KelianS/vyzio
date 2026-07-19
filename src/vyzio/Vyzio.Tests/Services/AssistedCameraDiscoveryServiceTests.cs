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
        var serverTask = Task.Run(async () =>
        {
            using var client = await listener.AcceptTcpClientAsync();
            using var stream = client.GetStream();
            var buffer = new byte[1024];
            _ = await stream.ReadAsync(buffer);

            var payload = "RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\nWWW-Authenticate: Digest realm=\"Tapo\"\r\n\r\n";
            var bytes = Encoding.UTF8.GetBytes(payload);
            await stream.WriteAsync(bytes);
            await stream.FlushAsync();
        });

        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["127.0.0.1"],
                RtspPorts = [port],
                RtspPaths = ["/stream1"],
                HttpPorts = [],
                OnvifPorts = [],
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
                PortScanPorts = [],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();

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

    [Fact]
    public async Task DiscoverAsync_returns_candidate_from_configured_cidr()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();

        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        using var acceptCts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        var acceptTask = listener.AcceptTcpClientAsync(acceptCts.Token).AsTask();

        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeCidrs = ["127.0.0.1/32"],
                RtspPorts = [port],
                RtspPaths = [],
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
                PortScanPorts = [],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();

        using var client = await acceptTask;
        var candidate = Assert.Single(result, item => item.Host == "127.0.0.1" && item.Port == port);
        Assert.Equal("network_scan", candidate.DiscoverySource);
        Assert.Equal("camera_likely", candidate.Qualification);
        Assert.Contains("rtsp_responding", candidate.QualificationReasons);
        Assert.Null(candidate.MacAddress);
    }

    [Fact]
    public async Task DiscoverAsync_returns_http_candidate_with_tapo_hint()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();

        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        var serverTask = Task.Run(async () =>
        {
            using (var client = await listener.AcceptTcpClientAsync())
            using (var stream = client.GetStream())
            {
                var buffer = new byte[1024];
                _ = await stream.ReadAsync(buffer);

                var firstPayload = "HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n";
                var firstBytes = Encoding.UTF8.GetBytes(firstPayload);
                await stream.WriteAsync(firstBytes);
                await stream.FlushAsync();
            }

            using var secondClient = await listener.AcceptTcpClientAsync();
            using var secondStream = secondClient.GetStream();
            var secondBuffer = new byte[1024];
            _ = await secondStream.ReadAsync(secondBuffer);

            var payload = "HTTP/1.1 200 OK\r\nServer: TP-Link Tapo\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n<html><head><title>Tapo Camera</title></head><body>Tapo</body></html>";
            var bytes = Encoding.UTF8.GetBytes(payload);
            await secondStream.WriteAsync(bytes);
            await secondStream.FlushAsync();
        });

        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["127.0.0.1"],
                RtspPorts = [],
                HttpPorts = [port],
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
                PortScanPorts = [],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();
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
        var serverTask = Task.Run(async () =>
        {
            using (var client = await listener.AcceptTcpClientAsync())
            using (var stream = client.GetStream())
            {
                var buffer = new byte[1024];
                _ = await stream.ReadAsync(buffer);

                var firstPayload = "HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n";
                var firstBytes = Encoding.UTF8.GetBytes(firstPayload);
                await stream.WriteAsync(firstBytes);
                await stream.FlushAsync();
            }

            using var secondClient = await listener.AcceptTcpClientAsync();
            using var secondStream = secondClient.GetStream();
            var secondBuffer = new byte[1024];
            _ = await secondStream.ReadAsync(secondBuffer);

            var payload = "HTTP/1.1 200 OK\r\nServer: nginx\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n<html><head><title>Admin Portal</title></head><body>hello</body></html>";
            var bytes = Encoding.UTF8.GetBytes(payload);
            await secondStream.WriteAsync(bytes);
            await secondStream.FlushAsync();
        });

        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["127.0.0.1"],
                RtspPorts = [],
                HttpPorts = [port],
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
                PortScanPorts = [],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();
        await serverTask;

        var candidate = Assert.Single(result, item => item.Host == "127.0.0.1" && item.Port == port);
        Assert.Equal("http_service", candidate.DiscoverySource);
        Assert.Equal("device_unknown", candidate.Qualification);
        Assert.Contains("http_service_detected", candidate.QualificationReasons);
        Assert.DoesNotContain("http_camera_signature", candidate.QualificationReasons);
    }

    [Fact]
    public async Task DiscoverAsync_returns_onvif_unicast_candidate_without_web_ui()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();

        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        var serverTask = Task.Run(async () =>
        {
            using var client = await listener.AcceptTcpClientAsync();
            using var stream = client.GetStream();
            var buffer = new byte[2048];
            _ = await stream.ReadAsync(buffer);

            var payload = "HTTP/1.1 401 Unauthorized\r\nContent-Type: application/soap+xml\r\nWWW-Authenticate: Digest realm=\"ONVIF\"\r\nConnection: close\r\n\r\n<s:Envelope xmlns:s=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:tds=\"http://www.onvif.org/ver10/device/wsdl\"><s:Body><s:Fault><s:Reason><s:Text xml:lang=\"en\">NotAuthorized</s:Text></s:Reason></s:Fault></s:Body></s:Envelope>";
            var bytes = Encoding.UTF8.GetBytes(payload);
            await stream.WriteAsync(bytes);
            await stream.FlushAsync();
        });

        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["127.0.0.1"],
                RtspPorts = [],
                HttpPorts = [port],
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
                PortScanPorts = [],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();
        await serverTask;

        var candidate = Assert.Single(result, item => item.Host == "127.0.0.1" && item.Port == port);
        Assert.Equal("onvif_unicast", candidate.DiscoverySource);
        Assert.Equal("onvif", candidate.SourceType);
        Assert.Equal("camera_confirmed", candidate.Qualification);
        Assert.Contains("onvif_detected", candidate.QualificationReasons);
    }

    [Fact]
    public async Task DiscoverAsync_returns_candidate_from_configured_onvif_port()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();

        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        var serverTask = Task.Run(async () =>
        {
            using var client = await listener.AcceptTcpClientAsync();
            using var stream = client.GetStream();
            var buffer = new byte[2048];
            _ = await stream.ReadAsync(buffer);

            var payload = "HTTP/1.1 401 Unauthorized\r\nContent-Type: application/soap+xml\r\nWWW-Authenticate: Digest realm=\"ONVIF\"\r\nConnection: close\r\n\r\n<s:Envelope xmlns:s=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:tds=\"http://www.onvif.org/ver10/device/wsdl\"><s:Body><s:Fault><s:Reason><s:Text xml:lang=\"en\">NotAuthorized</s:Text></s:Reason></s:Fault></s:Body></s:Envelope>";
            var bytes = Encoding.UTF8.GetBytes(payload);
            await stream.WriteAsync(bytes);
            await stream.FlushAsync();
        });

        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["127.0.0.1"],
                RtspPorts = [],
                HttpPorts = [],
                OnvifPorts = [port],
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
                PortScanPorts = [],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();
        await serverTask;

        var candidate = Assert.Single(result, item => item.Host == "127.0.0.1" && item.Port == port);
        Assert.Equal("onvif_unicast", candidate.DiscoverySource);
        Assert.Equal("camera_confirmed", candidate.Qualification);
        Assert.Contains("onvif_detected", candidate.QualificationReasons);
    }

    // ADR-32: an identified host that matches no protocol/vendor signal no longer disappears —
    // it now surfaces as a device_unknown "network_host" baseline candidate (backlog: "show
    // everything found, even unmatched, at lower priority"). This replaces the old expectation
    // that a rejected SOAP gateway produced literally zero output.
    [Fact]
    public async Task DiscoverAsync_does_not_treat_generic_soap_gateway_as_onvif_camera()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();

        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        var serverTask = Task.Run(async () =>
        {
            using var client = await listener.AcceptTcpClientAsync();
            using var stream = client.GetStream();
            var buffer = new byte[2048];
            _ = await stream.ReadAsync(buffer);

            var payload = "HTTP/1.1 401 Unauthorized\r\nContent-Type: application/soap+xml\r\nWWW-Authenticate: Digest realm=\"BBOX\"\r\nConnection: close\r\n\r\n<s:Envelope xmlns:s=\"http://www.w3.org/2003/05/soap-envelope\"><s:Body><s:Fault><s:Reason><s:Text xml:lang=\"en\">Unauthorized</s:Text></s:Reason></s:Fault></s:Body></s:Envelope>";
            var bytes = Encoding.UTF8.GetBytes(payload);
            await stream.WriteAsync(bytes);
            await stream.FlushAsync();
        });

        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["127.0.0.1"],
                RtspPorts = [],
                HttpPorts = [],
                OnvifPorts = [port],
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
                PortScanPorts = [],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();
        await serverTask;

        var candidate = Assert.Single(result, item => item.Host == "127.0.0.1");
        Assert.Equal("network_host", candidate.DiscoverySource);
        Assert.Equal("device_unknown", candidate.Qualification);
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
                RtspPorts = [],
                RtspPaths = [],
                HttpPorts = [],
                OnvifPorts = [],
                ProbeTimeoutMs = 200,
                MaxConcurrentProbes = 1,
                PortScanPorts = [],
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
                RtspPorts = [],
                RtspPaths = [],
                HttpPorts = [],
                OnvifPorts = [],
                ProbeTimeoutMs = 200,
                MaxConcurrentProbes = 1,
                PortScanPorts = [],
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
                RtspPorts = [],
                RtspPaths = [],
                HttpPorts = [],
                OnvifPorts = [],
                ProbeTimeoutMs = 200,
                MaxConcurrentProbes = 1,
                PortScanPorts = [],
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

        var rtspServerTask = Task.Run(async () =>
        {
            using var client = await rtspListener.AcceptTcpClientAsync();
            using var stream = client.GetStream();
            var buffer = new byte[1024];
            _ = await stream.ReadAsync(buffer);

            var payload = "RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\nWWW-Authenticate: Digest realm=\"Tapo\"\r\n\r\n";
            var bytes = Encoding.UTF8.GetBytes(payload);
            await stream.WriteAsync(bytes);
            await stream.FlushAsync();
        });

        var httpServerTask = Task.Run(async () =>
        {
            using (var client = await httpListener.AcceptTcpClientAsync())
            using (var stream = client.GetStream())
            {
                var buffer = new byte[1024];
                _ = await stream.ReadAsync(buffer);

                var firstPayload = "HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n";
                var firstBytes = Encoding.UTF8.GetBytes(firstPayload);
                await stream.WriteAsync(firstBytes);
                await stream.FlushAsync();
            }

            using var secondClient = await httpListener.AcceptTcpClientAsync();
            using var secondStream = secondClient.GetStream();
            var secondBuffer = new byte[1024];
            _ = await secondStream.ReadAsync(secondBuffer);

            var payload = "HTTP/1.1 200 OK\r\nServer: TP-Link Tapo\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n<html><head><title>Tapo Camera</title></head><body>Tapo</body></html>";
            var bytes = Encoding.UTF8.GetBytes(payload);
            await secondStream.WriteAsync(bytes);
            await secondStream.FlushAsync();
        });

        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["127.0.0.1"],
                RtspPorts = [rtspPort],
                RtspPaths = ["/stream1"],
                HttpPorts = [httpPort],
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
                PortScanPorts = [],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();

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

        var rtspServerTask = Task.Run(async () =>
        {
            using var client = await rtspListener.AcceptTcpClientAsync();
            using var stream = client.GetStream();
            var buffer = new byte[1024];
            _ = await stream.ReadAsync(buffer);

            var payload = "RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\nWWW-Authenticate: Digest realm=\"Camera\"\r\n\r\n";
            var bytes = Encoding.UTF8.GetBytes(payload);
            await stream.WriteAsync(bytes);
            await stream.FlushAsync();
        });

        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["127.0.0.1", "c200-camera-tapo.lan"],
                RtspPorts = [rtspPort],
                RtspPaths = ["/stream1"],
                HttpPorts = [],
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
                PortScanPorts = [],
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();

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
                RtspPorts = [],
                RtspPaths = [],
                HttpPorts = [],
                OnvifPorts = [],
                ProbeTimeoutMs = 200,
                MaxConcurrentProbes = 1,
                PortScanPorts = [],
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
                RtspPorts = [],
                HttpPorts = [port],
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
                PortScanPorts = [],
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
                RtspPorts = [],
                HttpPorts = [],
                OnvifPorts = [],
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
                PortScanPorts = [dvripPort],
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
                RtspPorts = [],
                HttpPorts = [],
                OnvifPorts = [],
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
                PortScanPorts = [v380Port],
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