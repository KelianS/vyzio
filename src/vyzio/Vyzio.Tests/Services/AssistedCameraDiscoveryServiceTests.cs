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
            using var client = await listener.AcceptTcpClientAsync();
            using var stream = client.GetStream();
            var buffer = new byte[1024];
            _ = await stream.ReadAsync(buffer);

            var payload = "HTTP/1.1 200 OK\r\nServer: TP-Link Tapo\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n<html><head><title>Tapo Camera</title></head><body>Tapo</body></html>";
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
        Assert.Equal("http_probe", candidate.DiscoverySource);
        Assert.Equal("web_setup", candidate.SourceType);
        Assert.Contains("Tapo", candidate.Note);
        Assert.Null(candidate.MacAddress);
    }
}