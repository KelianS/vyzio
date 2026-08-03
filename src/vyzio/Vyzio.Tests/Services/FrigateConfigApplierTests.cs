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
        if (File.Exists($"{_configPath}.pending")) File.Delete($"{_configPath}.pending");
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

    private sealed class StubHardwareAccelerationDetector(
        FrigateDetectorKind kind,
        int cpuCoreCount = 4,
        FrigateHwAccel hwAccel = FrigateHwAccel.None) : IHardwareAccelerationDetector
    {
        public FrigateDetectorKind Detect() => kind;
        public FrigateHwAccel DetectVideoAcceleration() => hwAccel;
        public int CpuCoreCount => cpuCoreCount;
    }

    // Real IFrigateModelAssetInstaller copies bundled files from /app/models — not present on the
    // test runner, and not the concern of these tests (config generation only).
    private sealed class NoopModelAssetInstaller : IFrigateModelAssetInstaller
    {
        public Task EnsureInstalledAsync(FrigateDetectorKind detectorKind, string configDirectory, CancellationToken ct = default) =>
            Task.CompletedTask;
    }

    private sealed class StubRecordingSettingsRepository(RecordingSettings settings) : IRecordingSettingsRepository
    {
        public Task<RecordingSettings> GetAsync(CancellationToken ct = default) => Task.FromResult(settings);
        public Task SaveAsync(RecordingSettings toSave, CancellationToken ct = default) => Task.CompletedTask;
    }

    private async Task<string> ApplyAndReadYamlAsync(
        Camera[] cameras,
        FrigateDetectorKind detectorKind = FrigateDetectorKind.Cpu,
        int cpuCoreCount = 4,
        FrigateHwAccel hwAccel = FrigateHwAccel.None,
        RecordingSettings? recordingSettings = null)
    {
        var settings = Settings;
        var planner = new FrigateDetectorPlanner(
            settings,
            new StubHardwareAccelerationDetector(detectorKind, cpuCoreCount, hwAccel));
        var applier = new FrigateConfigApplier(
            settings,
            NullLogger<FrigateConfigApplier>.Instance,
            new FrigateRestartTracker(),
            planner,
            new NoopModelAssetInstaller(),
            new StubRecordingSettingsRepository(recordingSettings ?? RecordingSettings.CreateDefault()));
        await applier.ApplyAsync(cameras);
        return await File.ReadAllTextAsync(_configPath);
    }

    private FrigateConfigApplier BuildApplier()
    {
        var settings = Settings;
        return new FrigateConfigApplier(
            settings,
            NullLogger<FrigateConfigApplier>.Instance,
            new FrigateRestartTracker(),
            new FrigateDetectorPlanner(settings, new StubHardwareAccelerationDetector(FrigateDetectorKind.Cpu)),
            new NoopModelAssetInstaller(),
            new StubRecordingSettingsRepository(RecordingSettings.CreateDefault()));
    }

    // The wait must survive between a save and the user's restart, and keep what it is waiting on.

    [Fact]
    public void Nothing_waits_before_anything_is_written()
    {
        Assert.Empty(BuildApplier().PendingChanges);
    }

    [Fact]
    public async Task Writing_the_config_records_what_is_waiting_by_name()
    {
        var applier = BuildApplier();

        await applier.WriteConfigAsync([MakeValidatedCamera("front-door")], [SurveillanceChangeScope.Detection]);

        Assert.Equal([SurveillanceChangeScope.Detection], applier.PendingChanges);
    }

    [Fact]
    public async Task Successive_writes_accumulate_their_scopes_without_repeating_them()
    {
        var applier = BuildApplier();
        var cameras = new[] { MakeValidatedCamera("front-door") };

        // Several settings, several pages, one restart later on: each has to keep its name until
        // the user decides.
        await applier.WriteConfigAsync(cameras, [SurveillanceChangeScope.Detection]);
        await applier.WriteConfigAsync(cameras, [SurveillanceChangeScope.Retention]);
        await applier.WriteConfigAsync(cameras, [SurveillanceChangeScope.Detection]);

        Assert.Equal([SurveillanceChangeScope.Detection, SurveillanceChangeScope.Retention], applier.PendingChanges);
    }

    [Fact]
    public async Task Applying_the_config_clears_the_wait()
    {
        var applier = BuildApplier();
        var cameras = new[] { MakeValidatedCamera("front-door") };
        await applier.WriteConfigAsync(cameras, [SurveillanceChangeScope.Detection]);

        await applier.ApplyAsync(cameras);

        Assert.Empty(applier.PendingChanges);
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
    public async Task Openvino_detected_emits_onnx_detector_with_yolox_s_model()
    {
        var yaml = await ApplyAndReadYamlAsync([MakeValidatedCamera("front-door")], FrigateDetectorKind.Openvino);

        Assert.Contains("type: onnx", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("yolox_s.onnx", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("yolox", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("coco-80.txt", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Cpu_detected_emits_native_cpu_detector_not_onnx()
    {
        var yaml = await ApplyAndReadYamlAsync([MakeValidatedCamera("front-door")], FrigateDetectorKind.Cpu);

        Assert.Contains("cpu1", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("type: cpu", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("onnx", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("yolox", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("ssdlite_mobilenet_v2", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Intel_gpu_present_emits_vaapi_hardware_decoding()
    {
        var yaml = await ApplyAndReadYamlAsync(
            [MakeValidatedCamera("front-door")], hwAccel: FrigateHwAccel.Vaapi);

        Assert.Contains("hwaccel_args: preset-vaapi", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task No_gpu_emits_no_hardware_decoding_section()
    {
        var yaml = await ApplyAndReadYamlAsync([MakeValidatedCamera("front-door")]);

        Assert.DoesNotContain("hwaccel_args", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Coral_host_with_an_intel_igpu_keeps_gpu_decoding()
    {
        // The classic Frigate build: inference on the Coral, decoding still on the iGPU.
        var yaml = await ApplyAndReadYamlAsync(
            [MakeValidatedCamera("front-door")], FrigateDetectorKind.EdgeTpu, hwAccel: FrigateHwAccel.Vaapi);

        Assert.Contains("edgetpu", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("hwaccel_args: preset-vaapi", yaml, StringComparison.OrdinalIgnoreCase);
    }

    // ── Detect / record stream roles (ADR-38) ──

    private static CameraStream AddStream(Camera camera, int ordinal, string? path, int? width = null, int? height = null)
    {
        var stream = new CameraStream
        {
            CameraId = camera.Id,
            Ordinal = ordinal,
            Path = path,
            Width = width,
            Height = height,
        };
        camera.Streams.Add(stream);
        return stream;
    }

    [Fact]
    public async Task Single_stream_camera_keeps_one_input_carrying_both_roles()
    {
        var yaml = await ApplyAndReadYamlAsync([MakeValidatedCamera("front-door")]);

        Assert.Contains("- detect", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("- record", yaml, StringComparison.OrdinalIgnoreCase);
        // One input means the stream path appears exactly once.
        Assert.Equal(1, CountOccurrences(yaml, "rtsp://192.168.1.10:554/stream1"));
    }

    // Frigate downscales the detect image anyway, so the lighter stream is the default (ADR-38).
    [Fact]
    public async Task A_sub_stream_carries_detection_by_default_without_any_user_choice()
    {
        var camera = MakeValidatedCamera("front-door");
        AddStream(camera, 1, "/stream2", 640, 360);

        var yaml = await ApplyAndReadYamlAsync([camera]);

        Assert.Contains("stream2", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("width: 640", yaml, StringComparison.OrdinalIgnoreCase);
        // Recording never leaves the main stream.
        Assert.Contains("stream1", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Choosing_the_main_stream_puts_both_roles_back_on_it()
    {
        var camera = MakeValidatedCamera("front-door");
        AddStream(camera, 1, "/stream2", 640, 360);
        camera.DetectStreamId = camera.MainStream!.Id;

        var yaml = await ApplyAndReadYamlAsync([camera]);

        Assert.DoesNotContain("stream2", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(1, CountOccurrences(yaml, "rtsp://192.168.1.10:554/stream1"));
    }

    [Fact]
    public async Task Chosen_sub_stream_carries_detect_while_recording_stays_on_the_main_stream()
    {
        var camera = MakeValidatedCamera("front-door");
        var sub = AddStream(camera, 1, "/stream2", 640, 360);
        camera.DetectStreamId = sub.Id;

        var yaml = await ApplyAndReadYamlAsync([camera]);

        var detectIndex = yaml.IndexOf("stream2", StringComparison.OrdinalIgnoreCase);
        var recordIndex = yaml.IndexOf("stream1", StringComparison.OrdinalIgnoreCase);
        Assert.True(detectIndex >= 0 && recordIndex >= 0);
        // detect input is emitted first, record second — each with a single role.
        Assert.True(detectIndex < recordIndex);
        Assert.Contains("640", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Detect_resolution_is_emitted_only_when_the_stream_reported_one()
    {
        var withSize = MakeValidatedCamera("front-door");
        withSize.MainStream!.Width = 640;
        withSize.MainStream.Height = 480;

        var yaml = await ApplyAndReadYamlAsync([withSize]);
        Assert.Contains("width: 640", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("height: 480", yaml, StringComparison.OrdinalIgnoreCase);

        var withoutSize = await ApplyAndReadYamlAsync([MakeValidatedCamera("garage")]);
        Assert.DoesNotContain("width:", withoutSize, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Dvrip_sub_stream_gets_its_own_go2rtc_bridge()
    {
        var camera = MakeValidatedCamera("garden", StreamProtocol.Dvrip, null, 34567);
        var sub = AddStream(camera, 1, "?channel=0&subtype=1");
        camera.DetectStreamId = sub.Id;

        var yaml = await ApplyAndReadYamlAsync([camera]);

        // Two bridges: the sub-stream cannot share the main one's, or both roles would decode the
        // same stream and the separation would be cosmetic.
        Assert.Contains("garden_1:", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("subtype=1", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(1, CountOccurrences(yaml, "rtsp://127.0.0.1:8554/garden_1"));
        // The main bridge is still referenced on its own, for the record role.
        Assert.Equal(2, CountOccurrences(yaml, "rtsp://127.0.0.1:8554/garden"));
    }

    // ── Retention (ADR-39) ──

    // The bug this fixes: only `record.enabled: true` was emitted, so Frigate's own defaults
    // (continuous.days: 0, motion.days: 0) applied and nothing was ever kept.
    [Fact]
    public async Task Installation_retention_is_written_rather_than_left_to_frigate_defaults()
    {
        var yaml = await ApplyAndReadYamlAsync(
            [MakeValidatedCamera("front-door")],
            recordingSettings: new RecordingSettings { ContinuousDays = 2, MotionDays = 9, EventClipDays = 21 });

        Assert.Contains("continuous:", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("days: 2", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("days: 9", yaml, StringComparison.OrdinalIgnoreCase);
        // One Vyzio duration drives both of Frigate's event buckets.
        Assert.Equal(2, CountOccurrences(yaml, "days: 21"));
        Assert.Contains("alerts:", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("detections:", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task A_camera_without_overrides_emits_no_record_block_of_its_own()
    {
        var yaml = await ApplyAndReadYamlAsync([MakeValidatedCamera("front-door")]);

        // Only the root section — repeating installation values under the camera would hide where
        // the value actually comes from.
        Assert.Equal(1, CountOccurrences(yaml, "continuous:"));
    }

    [Fact]
    public async Task A_camera_override_is_emitted_alongside_the_installation_value()
    {
        var camera = MakeValidatedCamera("front-door");
        camera.ContinuousDaysOverride = 3;

        var yaml = await ApplyAndReadYamlAsync(
            [camera],
            recordingSettings: new RecordingSettings { ContinuousDays = 0, MotionDays = 7, EventClipDays = 14 });

        Assert.Equal(2, CountOccurrences(yaml, "continuous:"));
        Assert.Contains("days: 3", yaml, StringComparison.OrdinalIgnoreCase);
        // Only the overridden window is repeated: the motion window the camera did not override
        // appears once, at the root, so the camera still follows the installation on it.
        Assert.Equal(1, CountOccurrences(yaml, "days: 7"));
    }

    // Previously impossible to express: `record.enabled: true` was global and no camera overrode it,
    // so a camera the user did not want recorded was recorded anyway.
    [Fact]
    public async Task A_camera_keeping_nothing_has_recording_switched_off()
    {
        var camera = MakeValidatedCamera("front-door");
        camera.ContinuousDaysOverride = 0;
        camera.MotionDaysOverride = 0;
        camera.EventClipDaysOverride = 0;

        var yaml = await ApplyAndReadYamlAsync([camera]);

        // The camera's own record block is the only thing switched off — the camera itself stays
        // enabled for detection, and the installation still records everyone else.
        Assert.Equal(1, CountOccurrences(yaml, "enabled: false"));
    }

    [Fact]
    public async Task An_installation_keeping_nothing_switches_recording_off_at_the_root()
    {
        var yaml = await ApplyAndReadYamlAsync(
            [MakeValidatedCamera("front-door")],
            recordingSettings: new RecordingSettings { ContinuousDays = 0, MotionDays = 0, EventClipDays = 0 });

        var recordIndex = yaml.IndexOf("record:", StringComparison.OrdinalIgnoreCase);
        Assert.True(recordIndex >= 0);
        Assert.Contains("enabled: false", yaml[recordIndex..], StringComparison.OrdinalIgnoreCase);
    }

    private static int CountOccurrences(string haystack, string needle)
    {
        var count = 0;
        var index = haystack.IndexOf(needle, StringComparison.OrdinalIgnoreCase);
        while (index >= 0)
        {
            count++;
            index = haystack.IndexOf(needle, index + needle.Length, StringComparison.OrdinalIgnoreCase);
        }
        return count;
    }

    [Theory]
    [InlineData(MotionSensitivity.High, 10)]
    [InlineData(MotionSensitivity.Medium, 30)]
    [InlineData(MotionSensitivity.Low, 50)]
    public async Task Motion_sensitivity_is_emitted_as_contour_area(MotionSensitivity sensitivity, int expectedContourArea)
    {
        var camera = MakeValidatedCamera("front-door");
        camera.MotionSensitivity = sensitivity;

        var yaml = await ApplyAndReadYamlAsync([camera]);

        Assert.Contains($"contour_area: {expectedContourArea}", yaml, StringComparison.OrdinalIgnoreCase);
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
