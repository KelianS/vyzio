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
        using var acceptCts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        var acceptTask = listener.AcceptTcpClientAsync(acceptCts.Token).AsTask();

        var settings = new VyzioRuntimeSettings
        {
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = ["127.0.0.1"],
                RtspPorts = [port],
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
        Assert.Equal("unknown", candidate.SupportLevel);
        Assert.Contains("rtsp_responding", candidate.QualificationReasons);
        Assert.Null(candidate.StreamPath);
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

            var payload = "HTTP/1.1 401 Unauthorized\r\nContent-Type: application/soap+xml\r\nWWW-Authenticate: Digest realm=\"ONVIF\"\r\nConnection: close\r\n\r\n<s:Envelope xmlns:s=\"http://www.w3.org/2003/05/soap-envelope\"><s:Body>onvif</s:Body></s:Envelope>";
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
}