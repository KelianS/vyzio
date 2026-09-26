using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Services.CameraDiscovery;

namespace Vyzio.Tests.Services;

// ADR-32: the catalog is the single home for "which port may carry which protocol". The pipeline
// tests exercise the fingerprint mechanism on ephemeral ports, so the mapping itself is asserted
// here rather than by binding a well-known port on the machine running the suite.
public class DiscoveryPortCatalogTests
{
    [Theory]
    [InlineData(554, SupportedProtocol.Rtsp)]
    [InlineData(8554, SupportedProtocol.Rtsp)]
    [InlineData(8899, SupportedProtocol.Onvif)] // common on V380/XM
    [InlineData(8000, SupportedProtocol.Onvif)]
    [InlineData(8800, SupportedProtocol.V380)]
    [InlineData(34567, SupportedProtocol.Dvrip)]
    [InlineData(443, SupportedProtocol.TapoKlap)]
    public void FingerprintsForPort_ShouldOfferTheExpectedProtocol_WhenThePortConventionallyCarriesIt(int port, SupportedProtocol expected)
        => Assert.Contains(DiscoveryPortCatalog.FingerprintsForPort(port), f => f.Protocol == expected);

    // Port 80 is shared: a Tapo KLAP handshake and an ONVIF SOAP call are both worth attempting,
    // and only the passing one qualifies the host.
    [Fact]
    public void FingerprintsForPort_ShouldOfferBothOnvifAndTapoKlap_WhenThePortIsShared()
    {
        var protocols = DiscoveryPortCatalog.FingerprintsForPort(80).Select(f => f.Protocol).ToArray();

        Assert.Contains(SupportedProtocol.Onvif, protocols);
        Assert.Contains(SupportedProtocol.TapoKlap, protocols);
    }

    // A fingerprint on a port the sweep never opens is dead code: only scanned ports get probed.
    [Fact]
    public void Fingerprints_ShouldOnlyUseSweptPorts_WhenComparedWithTheScannedPorts()
    {
        var unswept = DiscoveryPortCatalog.Fingerprints
            .SelectMany(fingerprint => fingerprint.Ports)
            .Where(port => !DiscoveryPortCatalog.ScannedPorts.ContainsKey(port))
            .ToArray();

        Assert.Empty(unswept);
    }

    // Camera-protocol ports are not IANA-standard: an open one whose fingerprint fails must stay
    // "unidentified" rather than gain a misleading conventional service name.
    [Theory]
    [InlineData(2020)]
    [InlineData(8800)]
    [InlineData(8899)]
    [InlineData(34567)]
    public void ServiceLabel_ShouldBeEmpty_WhenThePortCarriesACameraProtocol(int port)
        => Assert.Equal(string.Empty, DiscoveryPortCatalog.ServiceLabel(port));

    [Fact]
    public void ServiceLabel_ShouldBeEmpty_WhenThePortIsOutsideTheCatalog()
        => Assert.Equal(string.Empty, DiscoveryPortCatalog.ServiceLabel(49152));
}
