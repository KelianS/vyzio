using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Services;
using Vyzio.Tests.Services;
using Vyzio.Tests.Services.Hosting;

namespace Vyzio.Tests.Contracts;

// The discovery port sweep run against one replaying camera, its port mapped to the protocol fingerprinted there (ADR-32).
internal static class SweptDiscovery
{
    public static async Task<DetectedPortSignal> DetectedPortAsync(CapturedTcpCamera camera, SupportedProtocol protocol)
    {
        var settings = AssistedCameraDiscoveryServiceTests.HermeticSettings(
            scanPorts: [camera.Port],
            portFingerprints: new Dictionary<int, SupportedProtocol> { [camera.Port] = protocol });
        var discovery = new AssistedCameraDiscoveryService(settings, BackgroundLoop.ClockAt("2026-10-04T20:00:00+00:00"));
        var candidate = Assert.Single(await discovery.DiscoverAsync().ObservedAsync());
        Assert.Equal("camera_confirmed", candidate.Qualification);
        return Assert.Single(candidate.TechnicalDetails!.DetectedPorts);
    }
}
