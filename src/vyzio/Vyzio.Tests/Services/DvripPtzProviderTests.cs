using Microsoft.Extensions.Logging.Abstractions;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.CapabilityProviders;

namespace Vyzio.Tests.Services;

public class DvripPtzProviderTests
{
    private static DvripPtzProvider MakeProvider() =>
        new(NullLogger<DvripPtzProvider>.Instance);

    [Fact]
    public void Protocol_is_Dvrip()
    {
        Assert.Equal(CapabilityProtocol.Dvrip, MakeProvider().Protocol);
    }

    [Fact]
    public async Task ProbeAsync_returns_false_when_camera_unreachable()
    {
        var camera = new Camera
        {
            Slug = "cam",
            DisplayName = "cam",
            Host = "127.0.0.1",
            Port = 554,
        };
        var binding = new CameraCapabilityBinding
        {
            CameraId = "cam",
            Capability = CameraCapability.Ptz,
            Protocol = CapabilityProtocol.Dvrip,
        };

        // Port 1 is reserved and always connection-refused — guaranteed no DVRIP listener.
        camera.Host = "127.0.0.1";

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(4));
        var result = await MakeProvider().ProbeAsync(camera, binding, cts.Token);

        Assert.False(result);
    }

    // SofiaHash — same algorithm as ICSeeXMEyeCameraAdapter, verified against a real camera.
    [Fact]
    public void SofiaHash_produces_verified_value()
    {
        Assert.Equal("6DDKEOQCGQGGILIK", DvripPtzProvider.SofiaHash("a4m3h5"));
    }

    [Fact]
    public void SofiaHash_returns_16_chars()
    {
        Assert.Equal(16, DvripPtzProvider.SofiaHash("any_password").Length);
    }

    [Fact]
    public void SofiaHash_empty_password_returns_16_chars()
    {
        Assert.Equal(16, DvripPtzProvider.SofiaHash(string.Empty).Length);
    }

    [Fact]
    public void SofiaHash_uses_only_allowed_charset()
    {
        const string allowed = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        var result = DvripPtzProvider.SofiaHash("test_password_123!");
        Assert.All(result, c => Assert.Contains(c, allowed));
    }

    [Theory]
    [InlineData(PtzDirection.Up, "DirectionUp")]
    [InlineData(PtzDirection.Down, "DirectionDown")]
    [InlineData(PtzDirection.Left, "DirectionLeft")]
    [InlineData(PtzDirection.Right, "DirectionRight")]
    [InlineData(PtzDirection.UpLeft, "DirectionLeftUp")]
    [InlineData(PtzDirection.UpRight, "DirectionRightUp")]
    [InlineData(PtzDirection.DownLeft, "DirectionLeftDown")]
    [InlineData(PtzDirection.DownRight, "DirectionRightDown")]
    public void DirectionToCommand_maps_all_directions(PtzDirection direction, string expected)
    {
        Assert.Equal(expected, DvripPtzProvider.DirectionToCommand(direction));
    }
}
