using System.Runtime.InteropServices;
using Microsoft.Extensions.Logging.Abstractions;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
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

    private static Camera MakeValidatedCamera(string slug, StreamProtocol streamProtocol = StreamProtocol.Rtsp, string? streamPath = "/stream1", int port = 554) => new()
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

    private sealed class StubHardwareAccelerationDetector(FrigateDetectorKind kind, int cpuCoreCount = 4) : IHardwareAccelerationDetector
    {
        public FrigateDetectorKind Detect() => kind;
        public int CpuCoreCount => cpuCoreCount;
    }

    private async Task<string> ApplyAndReadYamlAsync(Camera[] cameras, FrigateDetectorKind detectorKind = FrigateDetectorKind.Cpu, int cpuCoreCount = 4)
    {
        var settings = Settings;
        var planner = new FrigateDetectorPlanner(settings, new StubHardwareAccelerationDetector(detectorKind, cpuCoreCount));
        var applier = new FrigateConfigApplier(
            settings,
            NullLogger<FrigateConfigApplier>.Instance,
            new FrigateRestartTracker(),
            planner);
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
        var yaml = await ApplyAndReadYamlAsync([MakeValidatedCamera("garden", StreamProtocol.Dvrip, null, 34567)]);

        Assert.Contains("go2rtc:", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("streams:", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("dvrip://", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Dvrip_camera_ffmpeg_input_points_to_go2rtc_rtsp_bridge()
    {
        var yaml = await ApplyAndReadYamlAsync([MakeValidatedCamera("garden", StreamProtocol.Dvrip, null, 34567)]);

        Assert.Contains("rtsp://127.0.0.1:8554/garden", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("rtsp://192.168.1.10", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Mixed_cameras_only_dvrip_camera_listed_in_go2rtc_section()
    {
        var yaml = await ApplyAndReadYamlAsync(
        [
            MakeValidatedCamera("front-door"),
            MakeValidatedCamera("garden", StreamProtocol.Dvrip, null, 34567),
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
        var camera = MakeValidatedCamera("garden", StreamProtocol.Dvrip, null, 34567);
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

    [Fact]
    public async Task EdgeTpu_detected_emits_edgetpu_detector()
    {
        var yaml = await ApplyAndReadYamlAsync([MakeValidatedCamera("front-door")], FrigateDetectorKind.EdgeTpu);

        Assert.Contains("edgetpu", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("pci", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Openvino_detected_emits_openvino_gpu_detector()
    {
        var yaml = await ApplyAndReadYamlAsync([MakeValidatedCamera("front-door")], FrigateDetectorKind.Openvino);

        Assert.Contains("openvino", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("GPU", yaml);
        // model.path must never be omitted — Frigate 0.17.1 crashes at startup otherwise (ADR-34).
        Assert.Contains("ssdlite_mobilenet_v2.xml", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Cpu_tier_uses_openvino_cpu_device_rather_than_native_cpu_detector()
    {
        var yaml = await ApplyAndReadYamlAsync([MakeValidatedCamera("front-door")], FrigateDetectorKind.Cpu);

        Assert.Contains("openvino", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("CPU", yaml);
        Assert.Contains("ssdlite_mobilenet_v2.xml", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("cpu1", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task EdgeTpu_detected_does_not_scale_fps_with_camera_count()
    {
        var cameras = Enumerable.Range(0, 6)
            .Select(i => MakeValidatedCamera($"cam-{i}"))
            .ToArray();

        var yaml = await ApplyAndReadYamlAsync(cameras, FrigateDetectorKind.EdgeTpu);

        Assert.Contains("fps: 5", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData(4, 1, 4)]
    [InlineData(4, 2, 2)]
    [InlineData(4, 5, 1)]
    [InlineData(16, 1, 5)]
    [InlineData(1, 1, 1)]
    public async Task Cpu_detector_scales_fps_by_core_count_and_camera_count_within_hard_bounds(int cpuCoreCount, int cameraCount, int expectedFps)
    {
        var cameras = Enumerable.Range(0, cameraCount)
            .Select(i => MakeValidatedCamera($"cam-{i}"))
            .ToArray();

        var yaml = await ApplyAndReadYamlAsync(cameras, FrigateDetectorKind.Cpu, cpuCoreCount);

        Assert.Contains($"fps: {expectedFps}", yaml, StringComparison.OrdinalIgnoreCase);
    }
}
