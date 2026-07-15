using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging.Abstractions;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.CapabilityProviders;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Tests.Services;

public class DvripPtzProviderTests
{
    private static DvripPtzProvider MakeProvider() =>
        new(new DvripClient(NullLogger<DvripClient>.Instance), NullLogger<DvripPtzProvider>.Instance);

    [Fact]
    public void Protocol_is_Dvrip()
    {
        Assert.Equal(SupportedProtocol.Dvrip, MakeProvider().Protocol);
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
            Protocol = SupportedProtocol.Dvrip,
        };

        // Port 1 is reserved and always connection-refused — guaranteed no DVRIP listener.
        camera.Host = "127.0.0.1";

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(4));
        var result = await MakeProvider().ProbeAsync(camera, binding, cts.Token);

        Assert.False(result);
    }

    // SofiaHash — pairs of raw MD5 bytes (not hex nibbles), matching python-dvr's reference
    // implementation. Verified against a real ICSee camera (2026-07-15, Ret=100 on login);
    // the previous hex-nibble-pairing variant was rejected (Ret=203, "Password is incorrect").
    [Fact]
    public void SofiaHash_produces_verified_value()
    {
        Assert.Equal("S8jyn9CB", DvripPtzProvider.SofiaHash("a4m3h5"));
    }

    [Fact]
    public void SofiaHash_returns_8_chars()
    {
        Assert.Equal(8, DvripPtzProvider.SofiaHash("any_password").Length);
    }

    [Fact]
    public void SofiaHash_empty_password_returns_8_chars()
    {
        Assert.Equal(8, DvripPtzProvider.SofiaHash(string.Empty).Length);
    }

    [Fact]
    public void SofiaHash_uses_only_allowed_charset()
    {
        const string allowed = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        var result = DvripPtzProvider.SofiaHash("test_password_123!");
        Assert.All(result, c => Assert.Contains(c, allowed));
    }

    // Left/Right (and diagonals) intentionally swapped vs. the DVRIP command name that would
    // seem intuitive — confirmed against real hardware (2026-07-15) that this camera's
    // horizontal axis is mirrored relative to Vyzio's Left/Right, while vertical was correct.
    [Theory]
    [InlineData(PtzDirection.Up, "DirectionUp")]
    [InlineData(PtzDirection.Down, "DirectionDown")]
    [InlineData(PtzDirection.Left, "DirectionRight")]
    [InlineData(PtzDirection.Right, "DirectionLeft")]
    [InlineData(PtzDirection.UpLeft, "DirectionRightUp")]
    [InlineData(PtzDirection.UpRight, "DirectionLeftUp")]
    [InlineData(PtzDirection.DownLeft, "DirectionRightDown")]
    [InlineData(PtzDirection.DownRight, "DirectionLeftDown")]
    public void DirectionToCommand_maps_all_directions(PtzDirection direction, string expected)
    {
        Assert.Equal(expected, DvripPtzProvider.DirectionToCommand(direction));
    }

    // Confirmed against real hardware (2026-07-15, via dbuezas/icsee-ptz): Preset=-1 is the
    // real stop sentinel, Preset=0 is a normal move. Sending Preset=-1 for a move (not just
    // stop) silently makes the camera ignore the command entirely — this is the single most
    // regression-prone detail in this file, hence a dedicated test.
    [Fact]
    public void BuildPtzPayload_move_uses_preset_zero()
    {
        var json = DvripPtzProvider.BuildPtzPayload("0x00000001", "DirectionRight", preset: 0, step: 5);
        var preset = JsonNode.Parse(json)?["OPPTZControl"]?["Parameter"]?["Preset"]?.GetValue<int>();
        Assert.Equal(0, preset);
    }

    [Fact]
    public void BuildPtzPayload_stop_uses_preset_minus_one()
    {
        var json = DvripPtzProvider.BuildPtzPayload("0x00000001", "DirectionUp", preset: -1, step: 5);
        var preset = JsonNode.Parse(json)?["OPPTZControl"]?["Parameter"]?["Preset"]?.GetValue<int>();
        Assert.Equal(-1, preset);
    }

    [Fact]
    public void BuildPtzPayload_has_no_action_or_point_field()
    {
        var json = DvripPtzProvider.BuildPtzPayload("0x00000001", "DirectionUp", preset: -1, step: 5);
        var node = JsonNode.Parse(json)!;

        Assert.Null(node["OPPTZControl"]!["Action"]);
        Assert.Null(node["OPPTZControl"]!["Parameter"]!["POINT"]);
        Assert.Equal("Start", node["OPPTZControl"]!["Parameter"]!["Pattern"]!.GetValue<string>());
    }
}
