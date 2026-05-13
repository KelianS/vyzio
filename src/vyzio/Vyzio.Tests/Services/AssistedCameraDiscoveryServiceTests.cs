using System.Net;
using System.Net.Sockets;
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
    }
}