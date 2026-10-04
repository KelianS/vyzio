using System.Net;
using System.Net.NetworkInformation;
using Vyzio.Infrastructure.Services.CameraDiscovery;

namespace Vyzio.Tests.Services;

public class LocalSubnetsTests
{
    private static InterfaceAddress Lan(string address, int prefixLength, string name = "eth0", bool isUp = true) =>
        new(name, NetworkInterfaceType.Ethernet, isUp, IPAddress.Parse(address), prefixLength);

    [Fact]
    public void From_ShouldReturnTheHomeSubnet_WhenTheHostSitsOnAnUncommonRange()
    {
        // Arrange
        var addresses = new[] { Lan("192.168.10.23", 24) };

        // Act
        var cidrs = LocalSubnets.From(addresses);

        // Assert
        Assert.Equal(["192.168.10.0/24"], cidrs);
    }

    [Fact]
    public void From_ShouldNarrowToTheSurroundingSlash24_WhenThePrefixIsWider()
    {
        // Arrange
        var addresses = new[] { Lan("10.0.5.7", 16) };

        // Act
        var cidrs = LocalSubnets.From(addresses);

        // Assert
        Assert.Equal(["10.0.5.0/24"], cidrs);
    }

    [Fact]
    public void From_ShouldKeepThePrefix_WhenItIsNarrowerThanASlash24()
    {
        // Arrange
        var addresses = new[] { Lan("192.168.1.70", 26) };

        // Act
        var cidrs = LocalSubnets.From(addresses);

        // Assert
        Assert.Equal(["192.168.1.64/26"], cidrs);
    }

    [Theory]
    [InlineData("docker0", "172.17.0.1", 16)]
    [InlineData("br-3f2a9c", "172.18.0.1", 16)]
    [InlineData("veth12ab", "172.18.0.5", 16)]
    [InlineData("virbr0", "192.168.122.1", 24)]
    [InlineData("wg0", "10.8.0.2", 24)]
    public void From_ShouldIgnoreTheInterface_WhenItIsVirtual(string name, string address, int prefixLength)
    {
        // Arrange
        var addresses = new[] { Lan(address, prefixLength, name) };

        // Act
        var cidrs = LocalSubnets.From(addresses);

        // Assert
        Assert.Empty(cidrs);
    }

    [Fact]
    public void From_ShouldIgnoreTheInterface_WhenItIsLoopback()
    {
        // Arrange
        var addresses = new[] { new InterfaceAddress("lo", NetworkInterfaceType.Loopback, true, IPAddress.Loopback, 8) };

        // Act
        var cidrs = LocalSubnets.From(addresses);

        // Assert
        Assert.Empty(cidrs);
    }

    [Fact]
    public void From_ShouldIgnoreTheAddress_WhenItIsLinkLocal()
    {
        // Arrange
        var addresses = new[] { Lan("169.254.12.4", 16) };

        // Act
        var cidrs = LocalSubnets.From(addresses);

        // Assert
        Assert.Empty(cidrs);
    }

    [Fact]
    public void From_ShouldIgnoreTheInterface_WhenItIsDown()
    {
        // Arrange
        var addresses = new[] { Lan("192.168.1.20", 24, isUp: false) };

        // Act
        var cidrs = LocalSubnets.From(addresses);

        // Assert
        Assert.Empty(cidrs);
    }

    [Fact]
    public void From_ShouldIgnoreTheAddress_WhenItIsIpv6()
    {
        // Arrange
        var addresses = new[] { Lan("fe80::1", 64) };

        // Act
        var cidrs = LocalSubnets.From(addresses);

        // Assert
        Assert.Empty(cidrs);
    }

    [Fact]
    public void From_ShouldListTheSubnetOnce_WhenTwoInterfacesShareIt()
    {
        // Arrange
        var addresses = new[] { Lan("192.168.1.20", 24, "eth0"), Lan("192.168.1.21", 24, "wlan0") };

        // Act
        var cidrs = LocalSubnets.From(addresses);

        // Assert
        Assert.Equal(["192.168.1.0/24"], cidrs);
    }
}
