using System.Net;
using System.Net.Sockets;
using System.Text;
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
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
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
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();
        await serverTask;

        Assert.Empty(result);
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
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["v380pro-camera.lan"],
                RtspPorts = [],
                RtspPaths = [],
                HttpPorts = [],
                OnvifPorts = [],
                ProbeTimeoutMs = 200,
                MaxConcurrentProbes = 1,
            }
        };

        var sut = new AssistedCameraDiscoveryService(settings);

        var result = await sut.DiscoverAsync();

        var candidate = Assert.Single(result, item => item.Host == "v380pro-camera.lan");
        Assert.Equal("hostname_probe", candidate.DiscoverySource);
        Assert.Equal("camera_likely", candidate.Qualification);
        Assert.Equal("experimental", candidate.SupportLevel);
        Assert.Equal("v380_pro", candidate.VendorFamily);
        Assert.Contains("hostname_camera_hint", candidate.QualificationReasons);
        Assert.Contains("vendor_hint_detected", candidate.QualificationReasons);
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
}