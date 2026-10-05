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
    public void FingerprintsForPort_ShouldOfferTheExpectedProtocol_WhenThePortConventionallyCarriesIt(int port, SupportedProtocol expected)
        => Assert.Contains(DiscoveryPortCatalog.FingerprintsForPort(port), f => f.Protocol == expected);

    // The cameras do not speak KLAP, the Tapo smart-home protocol: discovery never attempts it (ADR-71).
    [Fact]
    public void Fingerprints_ShouldNotAttemptTapoKlap_WhenTheCatalogueIsBuilt()
    {
        // Act
        var protocols = DiscoveryPortCatalog.Fingerprints.Select(fingerprint => fingerprint.Protocol);

        // Assert
        Assert.DoesNotContain(SupportedProtocol.TapoKlap, protocols);
    }

    // A fingerprint on a port the sweep never opens is dead code: only scanned ports get probed.
    [Fact]
    public void Fingerprints_ShouldOnlyUseSweptPorts_WhenTheCatalogueIsBuilt()
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
