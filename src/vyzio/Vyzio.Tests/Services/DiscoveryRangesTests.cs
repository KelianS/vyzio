using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Configuration;
using Vyzio.Infrastructure.Services.CameraDiscovery;

namespace Vyzio.Tests.Services;

public class DiscoveryRangesTests
{
    [Theory]
    [InlineData("192.168.10.23", "192.168.10.0/24")]
    [InlineData("10.0.5.7", "10.0.5.0/24")]
    [InlineData("172.16.4.9", "172.16.4.0/24")]
    [InlineData("172.31.200.1", "172.31.200.0/24")]
    public void DashboardSubnet_ShouldReturnTheSurroundingSlash24_WhenTheAddressIsPrivate(string host, string expected)
    {
        // Act
        var subnet = DiscoveryRanges.DashboardSubnet(host);

        // Assert
        Assert.Equal(expected, subnet);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("vyzio.local")]
    [InlineData("localhost")]
    [InlineData("127.0.0.1")]
    [InlineData("[::1]")]
    [InlineData("fe80::1")]
    [InlineData("100.64.1.2")]
    [InlineData("169.254.12.4")]
    [InlineData("8.8.8.8")]
    [InlineData("172.32.0.1")]
    [InlineData("192.168.1")]
    [InlineData("3232235777")]
    public void DashboardSubnet_ShouldAddNothing_WhenTheHostIsNotAPrivateIpv4Address(string? host)
    {
        // Act
        var subnet = DiscoveryRanges.DashboardSubnet(host);

        // Assert
        Assert.Null(subnet);
    }

    [Fact]
    public void Resolve_ShouldListTheConfiguredRangesThenTheDashboardSubnet_WhenTheDashboardIsOpenedByAPrivateAddress()
    {
        // Act
        var ranges = DiscoveryRanges.Resolve(["192.168.0.0/24"], "192.168.1.20");

        // Assert
        Assert.Equal(
            [
                new DiscoveryRange("192.168.0.0/24", "192.168.0.1", "192.168.0.254", DiscoveryRangeSource.Configured),
                new DiscoveryRange("192.168.1.0/24", "192.168.1.1", "192.168.1.254", DiscoveryRangeSource.DashboardAddress),
            ],
            ranges);
    }

    [Fact]
    public void Resolve_ShouldListTheRangeOnceAsConfigured_WhenTheDashboardSubnetIsAlreadyConfigured()
    {
        // Act
        var ranges = DiscoveryRanges.Resolve(["192.168.1.0/24"], "192.168.1.20");

        // Assert
        Assert.Equal(DiscoveryRangeSource.Configured, Assert.Single(ranges).Source);
    }

    [Fact]
    public void Resolve_ShouldNormaliseTheNetworkAddress_WhenTheConfiguredRangeNamesAHost()
    {
        // Act
        var ranges = DiscoveryRanges.Resolve(["192.168.1.77/24"], null);

        // Assert
        Assert.Equal("192.168.1.0/24", Assert.Single(ranges).Cidr);
    }

    [Theory]
    [InlineData("not-a-range")]
    [InlineData("192.168.1.0")]
    [InlineData("192.168.1.0/33")]
    [InlineData("fe80::/64")]
    public void Resolve_ShouldLeaveOutTheRange_WhenItIsNotAnIpv4Cidr(string cidr)
    {
        // Act
        var ranges = DiscoveryRanges.Resolve([cidr], null);

        // Assert
        Assert.Empty(ranges);
    }

    [Fact]
    public void Swept_ShouldAddTheDashboardSubnet_WhenTheDashboardIsOpenedByAPrivateAddress()
    {
        // Arrange
        var settings = new VyzioRuntimeSettings.DiscoverySettings { ProbeCidrs = ["192.168.0.0/24"] };

        // Act
        var ranges = DiscoveryRanges.Swept(settings, "192.168.1.20");

        // Assert
        Assert.Contains(ranges, range => range.Cidr == "192.168.1.0/24" && range.Source == DiscoveryRangeSource.DashboardAddress);
    }

    [Fact]
    public void Swept_ShouldShowOnlyTheAddressesTried_WhenAConfiguredRangeGoesPastTheCap()
    {
        // Arrange
        var settings = new VyzioRuntimeSettings.DiscoverySettings { ProbeCidrs = ["10.0.0.0/16"], ProbeHosts = ["10.1.0.9"] };

        // Act
        var ranges = DiscoveryRanges.Swept(settings, null);

        // Assert
        var range = Assert.Single(ranges);
        Assert.Equal("10.0.0.1", range.FirstAddress);
        Assert.Equal("10.0.3.255", range.LastAddress);
    }

    [Fact]
    public void WithinCap_ShouldSweepTheDashboardSubnetFirst_WhenTheCapCutsTheRanges()
    {
        // Arrange
        var ranges = DiscoveryRanges.Resolve(["192.168.0.0/24"], "192.168.1.20");

        // Act
        var swept = DiscoveryRanges.WithinCap(ranges, 254);

        // Assert
        Assert.Equal(DiscoveryRangeSource.DashboardAddress, Assert.Single(swept).Source);
    }

    [Fact]
    public void Hosts_ShouldListEveryAddressButTheNetworkAndBroadcast_WhenTheRangeIsASlash30()
    {
        // Arrange
        var range = Assert.Single(DiscoveryRanges.Resolve(["10.0.0.0/30"], null));

        // Act
        var hosts = DiscoveryRanges.Hosts(range);

        // Assert
        Assert.Equal(["10.0.0.1", "10.0.0.2"], hosts);
    }

    [Fact]
    public void Hosts_ShouldListTheSingleAddress_WhenTheRangeIsASlash32()
    {
        // Arrange
        var range = Assert.Single(DiscoveryRanges.Resolve(["127.0.0.1/32"], null));

        // Act
        var hosts = DiscoveryRanges.Hosts(range);

        // Assert
        Assert.Equal(["127.0.0.1"], hosts);
    }
}
