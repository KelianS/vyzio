using System.Runtime.InteropServices;
using Microsoft.Extensions.Logging.Abstractions;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Configuration;
using Vyzio.Infrastructure.Services;

namespace Vyzio.Tests.Services;

public class FrigateConfigApplierTests : IDisposable
{
    private readonly string _configPath = Path.Combine(Path.GetTempPath(), $"frigate_test_{Guid.NewGuid():N}.yml");

    private VyzioRuntimeSettings Settings => new()
    {
        Frigate = new()
        {
            ConfigPath = _configPath,
            ApplyCommand = RuntimeInformation.IsOSPlatform(OSPlatform.Windows) ? "echo ok" : "echo ok",
            DatabasePath = "/db/frigate.db",
            Mqtt = new() { Host = "mosquitto", Port = 1883 },
        }
    };

    public void Dispose()
    {
        if (File.Exists(_configPath)) File.Delete(_configPath);
    }

    private static Camera MakeValidatedCamera(string slug, string streamProtocol = "rtsp", string? streamPath = "/stream1", int port = 554) => new()
    {
        Slug = slug,
        DisplayName = slug,
        Host = "192.168.1.10",
        Port = port,
        StreamPath = streamPath,
        StreamProtocol = streamProtocol,
        IsEnabled = true,
        ValidationState = "validated",
        FrigateCameraName = slug.Replace('-', '_'),
    };

    private async Task<string> ApplyAndReadYamlAsync(Camera[] cameras)
    {
        var applier = new FrigateConfigApplier(Settings, NullLogger<FrigateConfigApplier>.Instance);
        await applier.ApplyAsync(cameras);
        return await File.ReadAllTextAsync(_configPath);
    }

    [Fact]
    public async Task Rtsp_only_cameras_produce_no_go2rtc_section()
    {
        var yaml = await ApplyAndReadYamlAsync([MakeValidatedCamera("front-door")]);

        Assert.DoesNotContain("go2rtc", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("rtsp://", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Dvrip_camera_produces_go2rtc_section()
    {
        var yaml = await ApplyAndReadYamlAsync([MakeValidatedCamera("garden", "dvrip", null, 34567)]);

        Assert.Contains("go2rtc:", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("streams:", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("dvrip://", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Dvrip_camera_ffmpeg_input_points_to_go2rtc_rtsp_bridge()
    {
        var yaml = await ApplyAndReadYamlAsync([MakeValidatedCamera("garden", "dvrip", null, 34567)]);

        Assert.Contains("rtsp://127.0.0.1:8554/garden", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("rtsp://192.168.1.10", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Mixed_cameras_only_dvrip_camera_listed_in_go2rtc_section()
    {
        var yaml = await ApplyAndReadYamlAsync(
        [
            MakeValidatedCamera("front-door"),
            MakeValidatedCamera("garden", "dvrip", null, 34567),
        ]);

        Assert.Contains("go2rtc:", yaml, StringComparison.OrdinalIgnoreCase);
        // dvrip camera appears in go2rtc streams
        Assert.Contains("dvrip://", yaml, StringComparison.OrdinalIgnoreCase);
        // rtsp camera uses direct path (not via go2rtc)
        Assert.Contains("rtsp://192.168.1.10", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Dvrip_camera_with_credentials_includes_credentials_in_go2rtc_url()
    {
        var camera = MakeValidatedCamera("garden", "dvrip", null, 34567);
        camera.Username = "admin";
        camera.Password = "secret";

        var yaml = await ApplyAndReadYamlAsync([camera]);

        Assert.Contains("admin", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("secret", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Privacy_camera_emits_enabled_false_in_frigate_config()
    {
        var camera = MakeValidatedCamera("front-door");
        camera.PrivacyModeActive = true;

        var yaml = await ApplyAndReadYamlAsync([camera]);

        Assert.Contains("enabled: false", yaml, StringComparison.OrdinalIgnoreCase);
    }
}
