using System.Runtime.InteropServices;
using Microsoft.Extensions.Time.Testing;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Configuration;
using Vyzio.Infrastructure.Services;
using YamlDotNet.RepresentationModel;

namespace Vyzio.Tests.Services;

public sealed class FrigateConfigApplierTests : IDisposable
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

    private static Camera MakeValidatedCamera(string slug, SupportedProtocol streamProtocol = SupportedProtocol.Rtsp, string? streamPath = "/stream1") => new Camera
    {
        Slug = slug,
        DisplayName = slug,
        Host = "192.168.1.10",
        IsEnabled = true,
        ValidationState = CameraValidationState.Validated,
        FrigateCameraName = slug.Replace('-', '_'),
    }.WithStream(streamProtocol, path: streamPath);

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
            new FrigateRestartTracker(new FakeTimeProvider()),
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
            new FrigateRestartTracker(new FakeTimeProvider()),
            new FrigateDetectorPlanner(settings, new StubHardwareAccelerationDetector(FrigateDetectorKind.Cpu)),
            new NoopModelAssetInstaller(),
            new StubRecordingSettingsRepository(RecordingSettings.CreateDefault()));
    }

    // The wait survives between a save and the user's restart, and only a real change starts it.

    [Fact]
    public void HasPendingChanges_ShouldBeFalse_WhenNothingHasBeenWrittenYet()
    {
        Assert.False(BuildApplier().HasPendingChanges);
    }

    [Fact]
    public async Task WriteConfigAsync_ShouldLeaveARestartPending_WhenTheConfigReallyChanged()
    {
        var applier = BuildApplier();

        await applier.WriteConfigAsync([MakeValidatedCamera("front-door")], changed: true);

        Assert.True(applier.HasPendingChanges);
    }

    [Fact]
    public async Task WriteConfigAsync_ShouldLeaveNothingPending_WhenTheConfigDidNotChange()
    {
        var applier = BuildApplier();

        await applier.WriteConfigAsync([MakeValidatedCamera("front-door")], changed: false);

        Assert.False(applier.HasPendingChanges);
    }

    [Fact]
    public async Task ApplyAsync_ShouldClearThePendingRestart_WhenAWrittenChangeIsApplied()
    {
        var applier = BuildApplier();
        var cameras = new[] { MakeValidatedCamera("front-door") };
        await applier.WriteConfigAsync(cameras, changed: true);

        await applier.ApplyAsync(cameras);

        Assert.False(applier.HasPendingChanges);
    }

    [Fact]
    public async Task ApplyAsync_ShouldEmitNoGo2rtcStream_WhenEveryCameraStreamsOverRtsp()
    {
        var yaml = await ApplyAndReadYamlAsync([MakeValidatedCamera("front-door")]);

        Assert.Null(FindNode(yaml, "go2rtc", "streams"));
        Assert.DoesNotContain("127.0.0.1:8554", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("rtsp://", yaml, StringComparison.OrdinalIgnoreCase);
    }

    // Nothing Frigate starts on its own may reach the internet (ADR-70).

    [Fact]
    public async Task ApplyAsync_ShouldTurnOffFrigatesVersionCheck_WhenTheConfigIsWritten()
    {
        // Arrange
        Camera[] cameras = [MakeValidatedCamera("front-door")];

        // Act
        var yaml = await ApplyAndReadYamlAsync(cameras);

        // Assert
        Assert.Equal("false", ScalarAt(yaml, "telemetry", "version_check"));
    }

    [Theory]
    [InlineData(SupportedProtocol.Rtsp)]
    [InlineData(SupportedProtocol.Dvrip)]
    public async Task ApplyAsync_ShouldGiveGo2rtcNoWebrtcCandidateNorIceServer_WhenTheConfigIsWritten(SupportedProtocol protocol)
    {
        // Arrange
        Camera[] cameras = [MakeValidatedCamera("garden", protocol, null)];

        // Act
        var yaml = await ApplyAndReadYamlAsync(cameras);

        // Assert
        Assert.Empty(SequenceAt(yaml, "go2rtc", "webrtc", "candidates"));
        Assert.Empty(SequenceAt(yaml, "go2rtc", "webrtc", "ice_servers"));
    }

    [Fact]
    public async Task ApplyAsync_ShouldGiveGo2rtcNoWebrtcCandidateNorIceServer_WhenNoCameraIsConfigured()
    {
        // Arrange
        Camera[] cameras = [];

        // Act
        var yaml = await ApplyAndReadYamlAsync(cameras);

        // Assert
        Assert.Empty(SequenceAt(yaml, "go2rtc", "webrtc", "candidates"));
        Assert.Empty(SequenceAt(yaml, "go2rtc", "webrtc", "ice_servers"));
    }

    [Fact]
    public async Task ApplyAsync_ShouldAskForTheSmallFaceModel_WhenACameraIsActive()
    {
        // Arrange
        Camera[] cameras = [MakeValidatedCamera("front-door")];

        // Act
        var yaml = await ApplyAndReadYamlAsync(cameras);

        // Assert
        Assert.Equal("true", ScalarAt(yaml, "face_recognition", "enabled"));
        Assert.Equal("small", ScalarAt(yaml, "face_recognition", "model_size"));
    }

    private static YamlNode? FindNode(string yaml, params string[] path)
    {
        var stream = new YamlStream();
        stream.Load(new StringReader(yaml));
        YamlNode? node = stream.Documents[0].RootNode;
        foreach (var key in path)
        {
            node = node is YamlMappingNode mapping && mapping.Children.TryGetValue(new YamlScalarNode(key), out var child) ? child : null;
        }

        return node;
    }

    private static string? ScalarAt(string yaml, params string[] path) =>
        Assert.IsType<YamlScalarNode>(FindNode(yaml, path)).Value;

    private static IEnumerable<YamlNode> SequenceAt(string yaml, params string[] path) =>
        Assert.IsType<YamlSequenceNode>(FindNode(yaml, path)).Children;

    [Fact]
    public async Task ApplyAsync_ShouldEmitAGo2rtcSection_WhenACameraStreamsOverDvrip()
    {
        var yaml = await ApplyAndReadYamlAsync([MakeValidatedCamera("garden", SupportedProtocol.Dvrip, null)]);

        Assert.Contains("go2rtc:", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("streams:", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("dvrip://", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ApplyAsync_ShouldPointTheInputAtTheGo2rtcRtspBridge_WhenACameraStreamsOverDvrip()
    {
        var yaml = await ApplyAndReadYamlAsync([MakeValidatedCamera("garden", SupportedProtocol.Dvrip, null)]);

        Assert.Contains("rtsp://127.0.0.1:8554/garden", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("rtsp://192.168.1.10", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ApplyAsync_ShouldBridgeOnlyTheDvripCamera_WhenRtspAndDvripCamerasAreMixed()
    {
        var yaml = await ApplyAndReadYamlAsync(
        [
            MakeValidatedCamera("front-door"),
            MakeValidatedCamera("garden", SupportedProtocol.Dvrip, null),
        ]);

        Assert.Contains("go2rtc:", yaml, StringComparison.OrdinalIgnoreCase);
        // dvrip camera appears in go2rtc streams
        Assert.Contains("dvrip://", yaml, StringComparison.OrdinalIgnoreCase);
        // rtsp camera uses direct path (not via go2rtc)
        Assert.Contains("rtsp://192.168.1.10", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ApplyAsync_ShouldPutTheCredentialsInTheGo2rtcUrl_WhenADvripCameraHasCredentials()
    {
        var camera = MakeValidatedCamera("garden", SupportedProtocol.Dvrip, null);
        camera.Username = "admin";
        camera.Password = "secret";

        var yaml = await ApplyAndReadYamlAsync([camera]);

        Assert.Contains("admin", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("secret", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ApplyAsync_ShouldReadThePortAndAccountFromTheStreamProtocol_WhenTheProtocolCarriesItsOwn()
    {
        // Arrange
        var camera = MakeValidatedCamera("front-door");
        camera.Username = "camera-user";
        camera.Password = "camera-pass";
        var rtsp = camera.Protocol(SupportedProtocol.Rtsp)!;
        rtsp.Port = 8554;
        rtsp.Username = "stream-user";
        rtsp.Password = "stream-pass";

        // Act
        var yaml = await ApplyAndReadYamlAsync([camera]);

        // Assert
        Assert.Contains("rtsp://stream-user:stream-pass@192.168.1.10:8554/stream1", yaml, StringComparison.Ordinal);
        Assert.DoesNotContain("camera-user", yaml, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ApplyAsync_ShouldLeaveTheCameraOut_WhenItsStreamHasNoProtocolYet()
    {
        // Arrange
        var camera = new Camera
        {
            Slug = "porch",
            DisplayName = "porch",
            Host = "192.168.1.10",
            IsEnabled = true,
            ValidationState = CameraValidationState.Validated,
            FrigateCameraName = "porch",
        };

        // Act
        var yaml = await ApplyAndReadYamlAsync([camera]);

        // Assert
        Assert.DoesNotContain("porch:", yaml, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ApplyAsync_ShouldDisableTheCamera_WhenItsPrivacyModeIsActive()
    {
        var camera = MakeValidatedCamera("front-door");
        camera.PrivacyModeActive = true;

        var yaml = await ApplyAndReadYamlAsync([camera]);

        Assert.Contains("enabled: false", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ApplyAsync_ShouldEmitAnEdgeTpuDetector_WhenAnEdgeTpuIsDetected()
    {
        var yaml = await ApplyAndReadYamlAsync([MakeValidatedCamera("front-door")], FrigateDetectorKind.EdgeTpu);

        Assert.Contains("edgetpu", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("pci", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ApplyAsync_ShouldEmitAnOnnxDetectorWithTheYoloxSModel_WhenOpenvinoIsDetected()
    {
        var yaml = await ApplyAndReadYamlAsync([MakeValidatedCamera("front-door")], FrigateDetectorKind.Openvino);

        Assert.Contains("type: onnx", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("yolox_s.onnx", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("yolox", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("coco-80.txt", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ApplyAsync_ShouldEmitTheNativeCpuDetectorRatherThanOnnx_WhenOnlyTheCpuIsDetected()
    {
        var yaml = await ApplyAndReadYamlAsync([MakeValidatedCamera("front-door")], FrigateDetectorKind.Cpu);

        Assert.Contains("cpu1", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("type: cpu", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("onnx", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("yolox", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("ssdlite_mobilenet_v2", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ApplyAsync_ShouldEmitVaapiHardwareDecoding_WhenAnIntelGpuIsPresent()
    {
        var yaml = await ApplyAndReadYamlAsync(
            [MakeValidatedCamera("front-door")], hwAccel: FrigateHwAccel.Vaapi);

        Assert.Contains("hwaccel_args: preset-vaapi", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ApplyAsync_ShouldEmitNoHardwareDecoding_WhenNoGpuIsPresent()
    {
        var yaml = await ApplyAndReadYamlAsync([MakeValidatedCamera("front-door")]);

        Assert.DoesNotContain("hwaccel_args", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ApplyAsync_ShouldKeepGpuDecoding_WhenACoralHostAlsoHasAnIntelIgpu()
    {
        // The classic Frigate build: inference on the Coral, decoding still on the iGPU.
        var yaml = await ApplyAndReadYamlAsync(
            [MakeValidatedCamera("front-door")], FrigateDetectorKind.EdgeTpu, hwAccel: FrigateHwAccel.Vaapi);

        Assert.Contains("edgetpu", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("hwaccel_args: preset-vaapi", yaml, StringComparison.OrdinalIgnoreCase);
    }

    // ── Detect / record stream roles (ADR-38, ADR-65) ──

    private static CameraStream AddStream(
        Camera camera, string? path, StreamRole role, int? width = null, int? height = null, SupportedProtocol? protocol = null)
    {
        var binding = camera.StreamBinding!;
        var stream = StreamLineup.Add(binding, protocol ?? binding.Protocol, path, role);
        stream.Width = width;
        stream.Height = height;
        return stream;
    }

    [Fact]
    public async Task ApplyAsync_ShouldEmitOneInputCarryingBothRoles_WhenTheCameraHasASingleStream()
    {
        var yaml = await ApplyAndReadYamlAsync([MakeValidatedCamera("front-door")]);

        Assert.Contains("- detect", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("- record", yaml, StringComparison.OrdinalIgnoreCase);
        // One input means the stream path appears exactly once.
        Assert.Equal(1, CountOccurrences(yaml, "rtsp://192.168.1.10:554/stream1"));
    }

    [Fact]
    public async Task ApplyAsync_ShouldDetectOnTheSubStream_WhenTheSubStreamHoldsTheDetectRole()
    {
        var camera = MakeValidatedCamera("front-door");
        AddStream(camera, "/stream2", StreamRole.Detect, 640, 360);

        var yaml = await ApplyAndReadYamlAsync([camera]);

        Assert.Contains("stream2", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("width: 640", yaml, StringComparison.OrdinalIgnoreCase);
        // Recording never leaves the main stream.
        Assert.Contains("stream1", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ApplyAsync_ShouldPutBothRolesOnTheMainStream_WhenTheOtherStreamHoldsNoRole()
    {
        var camera = MakeValidatedCamera("front-door");
        AddStream(camera, "/stream2", StreamRole.None, 640, 360);

        var yaml = await ApplyAndReadYamlAsync([camera]);

        Assert.DoesNotContain("stream2", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(1, CountOccurrences(yaml, "rtsp://192.168.1.10:554/stream1"));
    }

    [Fact]
    public async Task ApplyAsync_ShouldDetectOnTheSubStreamAndRecordOnTheMain_WhenTheUserGivesDetectionToTheSubStream()
    {
        var camera = MakeValidatedCamera("front-door");
        AddStream(camera, "/stream2", StreamRole.Detect, 640, 360);

        var yaml = await ApplyAndReadYamlAsync([camera]);

        var detectIndex = yaml.IndexOf("stream2", StringComparison.OrdinalIgnoreCase);
        var recordIndex = yaml.IndexOf("stream1", StringComparison.OrdinalIgnoreCase);
        Assert.True(detectIndex >= 0 && recordIndex >= 0);
        // detect input is emitted first, record second — each with a single role.
        Assert.True(detectIndex < recordIndex);
        Assert.Contains("640", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ApplyAsync_ShouldRecordOnTheOtherStream_WhenRecordingWasGivenToIt()
    {
        // Arrange
        var camera = MakeValidatedCamera("front-door");
        AddStream(camera, "/stream2", StreamRole.RecordAndDetect);

        // Act
        var yaml = await ApplyAndReadYamlAsync([camera]);

        // Assert
        Assert.Equal(0, CountOccurrences(yaml, "rtsp://192.168.1.10:554/stream1"));
        Assert.Equal(1, CountOccurrences(yaml, "rtsp://192.168.1.10:554/stream2"));
    }

    [Fact]
    public async Task ApplyAsync_ShouldDetectOnTheRecordingStream_WhenNoOtherStreamHoldsARole()
    {
        // Arrange
        var camera = MakeValidatedCamera("front-door");
        AddStream(camera, "/stream2", StreamRole.None, 640, 360);

        // Act
        var yaml = await ApplyAndReadYamlAsync([camera]);

        // Assert
        Assert.DoesNotContain("stream2", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(1, CountOccurrences(yaml, "rtsp://192.168.1.10:554/stream1"));
    }

    [Fact]
    public async Task ApplyAsync_ShouldBridgeOnlyTheDvripStream_WhenTheDetectStreamGoesOverAnotherProtocol()
    {
        // Arrange
        var camera = MakeValidatedCamera("front-door");
        AddStream(camera, "?channel=0&subtype=1", StreamRole.Detect, protocol: SupportedProtocol.Dvrip);

        // Act
        var yaml = await ApplyAndReadYamlAsync([camera]);

        // Assert
        Assert.Equal(1, CountOccurrences(yaml, "rtsp://192.168.1.10:554/stream1"));
        Assert.Equal(1, CountOccurrences(yaml, "rtsp://127.0.0.1:8554/front_door_1"));
        Assert.Contains("subtype=1", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ApplyAsync_ShouldEmitTheDetectResolutionOnlyIfKnown_WhenTheStreamDidOrDidNotReportItsSize()
    {
        var withSize = MakeValidatedCamera("front-door");
        withSize.Streams.First().Width = 640;
        withSize.Streams.First().Height = 480;

        var yaml = await ApplyAndReadYamlAsync([withSize]);
        Assert.Contains("width: 640", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("height: 480", yaml, StringComparison.OrdinalIgnoreCase);

        var withoutSize = await ApplyAndReadYamlAsync([MakeValidatedCamera("garage")]);
        Assert.DoesNotContain("width:", withoutSize, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ApplyAsync_ShouldGiveTheSubStreamItsOwnGo2rtcBridge_WhenADvripCameraDetectsOnItsSubStream()
    {
        var camera = MakeValidatedCamera("garden", SupportedProtocol.Dvrip, null);
        AddStream(camera, "?channel=0&subtype=1", StreamRole.Detect);

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
    public async Task ApplyAsync_ShouldWriteEveryRetentionWindow_WhenTheInstallationSetsItsDurations()
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
    public async Task ApplyAsync_ShouldEmitNoCameraRecordBlock_WhenTheCameraHasNoOverride()
    {
        var yaml = await ApplyAndReadYamlAsync([MakeValidatedCamera("front-door")]);

        // Only the root section — repeating installation values under the camera would hide where
        // the value actually comes from.
        Assert.Equal(1, CountOccurrences(yaml, "continuous:"));
    }

    [Fact]
    public async Task ApplyAsync_ShouldRepeatOnlyTheOverriddenWindowUnderTheCamera_WhenTheCameraOverridesOneWindow()
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

    [Fact]
    public async Task ApplyAsync_ShouldKeepSnapshotsAsLongAsTheEventClips_WhenTheCameraOverridesTheClipDuration()
    {
        var camera = MakeValidatedCamera("front-door");
        camera.EventClipDaysOverride = 3;

        var yaml = await ApplyAndReadYamlAsync(
            [camera],
            recordingSettings: new RecordingSettings { EventClipDays = 30 });

        // An image outliving its clip would make the history lie about its own depth.
        var snapshotsIndex = yaml.IndexOf("snapshots:", StringComparison.OrdinalIgnoreCase);
        Assert.True(snapshotsIndex >= 0);
        Assert.Contains("default: 3", yaml[snapshotsIndex..], StringComparison.OrdinalIgnoreCase);
    }

    // ADR-48: a camera that keeps nothing no longer exists — an enabled camera keeps at least a day
    // of event clips, and not wanting its video is said by disabling the camera itself.
    [Fact]
    public async Task ApplyAsync_ShouldKeepADayAndStayRecorded_WhenACameraAsksForZeroEventClipDays()
    {
        var camera = MakeValidatedCamera("front-door");
        camera.ContinuousDaysOverride = 0;
        camera.MotionDaysOverride = 0;
        camera.EventClipDaysOverride = 0;

        // An installation duration that shares no prefix with "1", so the count below is the camera's.
        var yaml = await ApplyAndReadYamlAsync(
            [camera],
            recordingSettings: new RecordingSettings { EventClipDays = 30 });

        Assert.DoesNotContain("enabled: false", yaml, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(2, CountOccurrences(yaml, "days: 1"));
    }

    [Fact]
    public async Task ApplyAsync_ShouldKeepADayAtTheRoot_WhenTheInstallationAsksForZeroEventClipDays()
    {
        var yaml = await ApplyAndReadYamlAsync(
            [MakeValidatedCamera("front-door")],
            recordingSettings: new RecordingSettings { ContinuousDays = 0, MotionDays = 0, EventClipDays = 0 });

        var recordIndex = yaml.IndexOf("record:", StringComparison.OrdinalIgnoreCase);
        Assert.True(recordIndex >= 0);
        Assert.Contains("enabled: true", yaml[recordIndex..], StringComparison.OrdinalIgnoreCase);
        // Alerts and detections both follow the single Vyzio duration, floored at one day.
        Assert.Equal(2, CountOccurrences(yaml, "days: 1"));
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
    public async Task ApplyAsync_ShouldEmitTheMatchingContourArea_WhenTheCameraHasAMotionSensitivity(MotionSensitivity sensitivity, int expectedContourArea)
    {
        var camera = MakeValidatedCamera("front-door");
        camera.MotionSensitivity = sensitivity;

        var yaml = await ApplyAndReadYamlAsync([camera]);

        Assert.Contains($"contour_area: {expectedContourArea}", yaml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ApplyAsync_ShouldKeepTheDetectFpsFixed_WhenAnEdgeTpuServesManyCameras()
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
    public async Task ApplyAsync_ShouldScaleTheDetectFpsWithinHardBounds_WhenTheCpuDetectorSharesItsCoresAcrossCameras(int cpuCoreCount, int cameraCount, int expectedFps)
    {
        var cameras = Enumerable.Range(0, cameraCount)
            .Select(i => MakeValidatedCamera($"cam-{i}"))
            .ToArray();

        var yaml = await ApplyAndReadYamlAsync(cameras, FrigateDetectorKind.Cpu, cpuCoreCount);

        Assert.Contains($"fps: {expectedFps}", yaml, StringComparison.OrdinalIgnoreCase);
    }

    // The path as Frigate reads it, after YAML unquoting: the string it hands to its own escaping.
    private static List<string> ReadInputPaths(string yaml, string cameraKey)
    {
        var document = new YamlDotNet.Serialization.DeserializerBuilder().Build().Deserialize<Dictionary<string, object>>(yaml);
        var camera = (Dictionary<object, object>)((Dictionary<object, object>)document["cameras"])[cameraKey];
        var inputs = (List<object>)((Dictionary<object, object>)camera["ffmpeg"])["inputs"];
        return inputs.Select(input => (string)((Dictionary<object, object>)input)["path"]).ToList();
    }

    [Theory]
    [InlineData("Pass1?")]
    [InlineData("p@ss")]
    [InlineData("p#ss")]
    [InlineData("p:ss")]
    [InlineData("p/ss")]
    [InlineData("100%")]
    public async Task ApplyAsync_ShouldWriteThePasswordRaw_WhenFrigateEncodesItItself(string password)
    {
        var camera = MakeValidatedCamera("front-door");
        camera.Username = "viewer";
        camera.Password = password;

        var yaml = await ApplyAndReadYamlAsync([camera]);

        Assert.All(ReadInputPaths(yaml, "front_door"),
            path => Assert.Equal($"rtsp://viewer:{password}@192.168.1.10:554/stream1", path));
    }

    [Fact]
    public async Task ApplyAsync_ShouldDoubleTheBraces_WhenThePasswordContainsOne()
    {
        var camera = MakeValidatedCamera("front-door");
        camera.Username = "viewer";
        camera.Password = "p{ss}";

        var yaml = await ApplyAndReadYamlAsync([camera]);

        Assert.All(ReadInputPaths(yaml, "front_door"),
            path => Assert.Equal("rtsp://viewer:p{{ss}}@192.168.1.10:554/stream1", path));
    }

    [Theory]
    [InlineData("john.doe", "Pass1?", "john.doe:Pass1%3F")]
    [InlineData("viewer", "pass word", "viewer:pass%20word")]
    [InlineData("viewer", "", "viewer")]
    public async Task ApplyAsync_ShouldPercentEncodeTheCredentials_WhenFrigateWouldLeaveThemAsWritten(
        string username, string password, string expectedUserInfo)
    {
        var camera = MakeValidatedCamera("front-door");
        camera.Username = username;
        camera.Password = password;

        var yaml = await ApplyAndReadYamlAsync([camera]);

        Assert.All(ReadInputPaths(yaml, "front_door"),
            path => Assert.Equal($"rtsp://{expectedUserInfo}@192.168.1.10:554/stream1", path));
    }
}
