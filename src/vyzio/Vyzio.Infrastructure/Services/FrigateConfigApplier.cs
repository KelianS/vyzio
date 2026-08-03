using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Extensions.Logging;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Configuration;

namespace Vyzio.Infrastructure.Services;

public sealed class FrigateConfigApplier(
    VyzioRuntimeSettings settings,
    ILogger<FrigateConfigApplier> logger,
    IFrigateRestartTracker restartTracker,
    IFrigateDetectorPlanner detectorPlanner,
    IFrigateModelAssetInstaller modelAssetInstaller,
    IRecordingSettingsRepository recordingSettings) : IFrigateConfigApplier
{
    // Sentinel next to the generated config: the fact "written but not applied" belongs to the
    // config directory, not to a process. Kept out of the database on purpose — it survives an API
    // restart exactly as long as the un-applied config file it describes.
    private string? PendingMarkerPath
    {
        get
        {
            var configPath = settings.Frigate.ConfigPath;
            return string.IsNullOrWhiteSpace(configPath) ? null : $"{configPath}.pending";
        }
    }

    public IReadOnlyList<SurveillanceChangeScope> PendingChanges => ReadPending();

    public async Task WriteConfigAsync(IReadOnlyList<Camera> cameras, IReadOnlyList<SurveillanceChangeScope> scopes, CancellationToken ct = default)
    {
        if (!await WriteDocumentAsync(cameras, ct))
            return;

        MarkPending(scopes);
    }

    // ApplyAsync writes and restarts in one go, so marking there would only create a marker to erase.
    private async Task<bool> WriteDocumentAsync(IReadOnlyList<Camera> cameras, CancellationToken ct)
    {
        var configPath = settings.Frigate.ConfigPath;
        if (string.IsNullOrWhiteSpace(configPath))
            return false;

        // Retention is an installation-wide setting a camera may override (ADR-39), so it reaches the
        // applier through a port rather than through WriteConfigAsync's signature — no caller changes.
        var installation = await recordingSettings.GetAsync(ct);
        var (document, detectorKind) = BuildDocument(cameras, installation);
        var directory = Path.GetDirectoryName(configPath);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
            await modelAssetInstaller.EnsureInstalledAsync(detectorKind, directory, ct);
        }

        var serializer = new SerializerBuilder()
            .WithNamingConvention(UnderscoredNamingConvention.Instance)
            .ConfigureDefaultValuesHandling(DefaultValuesHandling.OmitNull)
            .Build();

        var yaml = serializer.Serialize(document);

        var tempPath = $"{configPath}.tmp";
        await File.WriteAllTextAsync(tempPath, yaml, ct);
        File.Move(tempPath, configPath, true);

        return true;
    }

    // Scopes accumulate: several pages can be edited before the user decides to restart.
    private void MarkPending(IReadOnlyList<SurveillanceChangeScope> scopes)
    {
        if (PendingMarkerPath is not { } path) return;

        var known = ReadPending();
        var merged = known.Concat(scopes).Distinct().ToList();
        if (merged.Count == known.Count) return;

        try { File.WriteAllLines(path, merged.Select(SnakeCaseEnum.ToSnakeCase)); }
        catch (IOException) { /* naming the wait is a convenience, never a reason to fail a save */ }
    }

    private IReadOnlyList<SurveillanceChangeScope> ReadPending()
    {
        if (PendingMarkerPath is not { } path || !File.Exists(path)) return [];

        try
        {
            return File.ReadAllLines(path)
                .Select(line => SnakeCaseEnum.TryFromSnakeCase<SurveillanceChangeScope>(line.Trim(), out var scope)
                    ? scope
                    : (SurveillanceChangeScope?)null)
                .OfType<SurveillanceChangeScope>()
                .Distinct()
                .ToList();
        }
        catch (IOException)
        {
            return [];
        }
    }

    private void ClearPending()
    {
        if (PendingMarkerPath is not { } path) return;
        try { File.Delete(path); }
        catch (IOException) { }
    }

    public async Task<FrigateConfigApplyResult> ApplyAsync(IReadOnlyList<Camera> cameras, CancellationToken ct = default)
    {
        var configPath = settings.Frigate.ConfigPath;

        if (string.IsNullOrWhiteSpace(configPath))
        {
            return new FrigateConfigApplyResult(false, "Frigate config path is not configured.", string.Empty);
        }

        await WriteDocumentAsync(cameras, ct);

        if (string.IsNullOrWhiteSpace(settings.Frigate.ApplyCommand))
        {
            return new FrigateConfigApplyResult(false, "Frigate apply command is not configured.", configPath);
        }

        var (fileName, arguments) = RuntimeInformation.IsOSPlatform(OSPlatform.Windows)
            ? ("cmd.exe", $"/c {settings.Frigate.ApplyCommand}")
            : ("/bin/sh", $"-lc \"{settings.Frigate.ApplyCommand.Replace("\"", "\\\"")}\"");

        restartTracker.MarkRestarting();

        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = fileName,
                Arguments = arguments,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
            }
        };

        process.Start();
        await process.WaitForExitAsync(ct);
        var standardError = await process.StandardError.ReadToEndAsync(ct);

        if (process.ExitCode != 0)
        {
            return new FrigateConfigApplyResult(false, string.IsNullOrWhiteSpace(standardError) ? "Frigate apply command failed." : standardError.Trim(), configPath);
        }

        ClearPending();
        return new FrigateConfigApplyResult(true, "Frigate configuration applied successfully.", configPath);
    }

    private (FrigateDocument Document, FrigateDetectorKind DetectorKind) BuildDocument(
        IReadOnlyList<Camera> cameras,
        RecordingSettings installation)
    {
        var validatedCameras = cameras
            .Where(camera => camera.IsEnabled)
            .Where(camera => string.Equals(camera.ValidationState, "validated", StringComparison.OrdinalIgnoreCase))
            .ToList();

        var plan = detectorPlanner.Plan(validatedCameras.Count);
        var detectorKind = plan.Kind;
        var detectFps = plan.Fps;

        var activeCameras = validatedCameras
            .ToDictionary(
                camera => camera.FrigateCameraName ?? camera.Slug.Replace('-', '_'),
                camera =>
                {
                    var frigateKey = camera.FrigateCameraName ?? camera.Slug.Replace('-', '_');
                    var labels = camera.GetDetectionLabels();
                    // face must be tracked whenever person is — Frigate needs it for face recognition.
                    var frigateLabels = labels.Contains("person")
                        ? labels.Union(["face"], StringComparer.OrdinalIgnoreCase).ToList()
                        : labels;
                    var detectStream = camera.DetectStream;
                    return new FrigateCameraConfig
                    {
                        Enabled = !camera.PrivacyModeActive,
                        Ffmpeg = new FrigateFfmpegConfig
                        {
                            Inputs = BuildInputs(camera, frigateKey),
                        },
                        Detect = new FrigateDetectConfig
                        {
                            Enabled = true,
                            Fps = detectFps,
                            // Only ever emitted from a real measured size. Left unset otherwise so
                            // Frigate applies its own default rather than a size we guessed (ADR-38).
                            Width = detectStream?.HasKnownResolution == true ? detectStream.Width : null,
                            Height = detectStream?.HasKnownResolution == true ? detectStream.Height : null,
                        },
                        // Persisted level mirrored into the config so it survives a Frigate restart —
                        // the tuning loop applies changes over MQTT at runtime (ADR-35).
                        Motion = new FrigateMotionConfig
                        {
                            ContourArea = FrigateMotionSettingsPublisher.ToContourArea(camera.MotionSensitivity),
                        },
                        Objects = new FrigateObjectsConfig
                        {
                            Track = [.. frigateLabels],
                        },
                        Snapshots = new FrigateSnapshotsConfig
                        {
                            Enabled = true,
                            BoundingBox = true,
                            Retain = new FrigateRetainConfig { Default = 30 },
                        },
                        Record = BuildCameraRecord(installation, camera),
                    };
                },
                StringComparer.OrdinalIgnoreCase);

        if (activeCameras.Count == 0)
        {
            activeCameras["dummy_camera"] = new FrigateCameraConfig
            {
                Enabled = false,
                Ffmpeg = new FrigateFfmpegConfig
                {
                    Inputs =
                    [
                        new FrigateInputConfig
                        {
                            Path = "rtsp://replace-me-with-your-stream",
                            Roles = ["detect"],
                        }
                    ]
                },
                Detect = new FrigateDetectConfig
                {
                    Enabled = true,
                    Fps = detectFps,
                }
            };
        }

        // Build go2rtc section for DVRIP cameras — go2rtc bridges dvrip:// → rtsp://127.0.0.1:8554/{slug}.
        // One entry per stream Frigate consumes: separating detect from record means the sub-stream
        // needs its own bridge, otherwise both roles would land on the same decoded stream.
        var dvripStreams = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        foreach (var camera in validatedCameras.Where(c => c.StreamProtocol == StreamProtocol.Dvrip))
        {
            var frigateKey = camera.FrigateCameraName ?? camera.Slug.Replace('-', '_');
            foreach (var stream in DistinctRoleStreams(camera))
            {
                dvripStreams[Go2rtcStreamName(frigateKey, stream)] = [BuildDvripUrl(camera, stream)];
            }
        }

        FrigateGo2rtcConfig? go2rtc = dvripStreams.Count > 0
            ? new FrigateGo2rtcConfig { Streams = dvripStreams }
            : null;

        // Enable face_recognition globally when at least one active camera is configured
        FrigateFaceRecognitionConfig? faceRecognition = activeCameras.Any(c => c.Value.Enabled)
            ? new FrigateFaceRecognitionConfig { Enabled = true }
            : null;

        var document = new FrigateDocument
        {
            Mqtt = new FrigateMqttConfig
            {
                Host = settings.Frigate.Mqtt.Host,
                Port = settings.Frigate.Mqtt.Port,
            },
            Database = new FrigateDatabaseConfig
            {
                Path = settings.Frigate.DatabasePath,
            },
            Ffmpeg = BuildFfmpeg(plan.HwAccel),
            Detectors = BuildDetectors(detectorKind),
            Model = BuildModel(detectorKind),
            FaceRecognition = faceRecognition,
            Go2rtc = go2rtc,
            Record = BuildInstallationRecord(installation),
            Cameras = activeCameras,
        };

        return (document, detectorKind);
    }

    // Software decoding is one of the most expensive things Frigate does, and it is pure waste when
    // a GPU is present (ADR-34). `preset-vaapi` is the codec-agnostic option: the QuickSync presets
    // suit gen13+/Arc better but exist only in per-codec variants (`-h264`/`-h265`), and Vyzio does
    // not record each camera's codec — so they are not selectable today (backlog).
    private static FrigateFfmpegGlobalConfig? BuildFfmpeg(FrigateHwAccel hwAccel) =>
        hwAccel == FrigateHwAccel.Vaapi
            ? new FrigateFfmpegGlobalConfig { HwaccelArgs = "preset-vaapi" }
            : null;

    // `onnx` (auto-detects OpenVINO as execution provider on the stock image) + YOLOX only for the
    // Openvino/Intel-GPU tier, where dedicated hardware absorbs the extra compute a YOLO-family model
    // costs over a plain SSD. Reverted for the CPU-only tier after field testing showed CPU spikes to
    // ~800% with 2 cameras and degraded detection (frames dropped under load) — even the smallest
    // YOLOX variant is heavier per-inference than the native `cpu` detector's own model (MobileDet),
    // which field testing separately confirmed reliable (ADR-34).
    private static Dictionary<string, FrigateDetectorConfig> BuildDetectors(FrigateDetectorKind detectorKind) =>
        detectorKind switch
        {
            FrigateDetectorKind.EdgeTpu => new Dictionary<string, FrigateDetectorConfig>
            {
                ["coral"] = new() { Type = "edgetpu", Device = "pci" }
            },
            FrigateDetectorKind.Openvino => new Dictionary<string, FrigateDetectorConfig>
            {
                ["onnx"] = new() { Type = "onnx" }
            },
            FrigateDetectorKind.Cpu => new Dictionary<string, FrigateDetectorConfig>
            {
                ["cpu1"] = new() { Type = "cpu" }
            },
            _ => throw new ArgumentOutOfRangeException(nameof(detectorKind), detectorKind, null),
        };

    // YOLOX (Apache-2.0 — no redistribution concern, unlike YOLOv9's GPL-3.0 or YOLO-NAS's
    // non-commercial weights, ADR-34) replaces ssdlite_mobilenet_v2 on the Openvino/Intel-GPU tier
    // only — bundled into the vyzio-api image and installed into the shared config volume by
    // IFrigateModelAssetInstaller. EdgeTpu and the native Cpu detector ship their own default model.
    private static FrigateModelConfig? BuildModel(FrigateDetectorKind detectorKind) =>
        detectorKind == FrigateDetectorKind.Openvino
            ? new FrigateModelConfig
            {
                ModelType = "yolox",
                Width = 640,
                Height = 640,
                InputTensor = "nchw",
                InputDtype = "float_denorm",
                Path = "/config/model_cache/yolox_s.onnx",
                LabelmapPath = "/labelmap/coco-80.txt",
            }
            : null;

    // Splits the roles across streams (ADR-38). When detection and recording land on the same stream
    // — no sub-stream, or the user kept the main one — a single input carries both roles, which is
    // also what Frigate does implicitly today. Two streams means two inputs, and recording always
    // stays on the main one: the detect stream may be the cheap one, never the archived one.
    private static List<FrigateInputConfig> BuildInputs(Camera camera, string frigateKey)
    {
        var main = camera.MainStream;
        var detect = camera.DetectStream;

        if (main is null || detect is null || ReferenceEquals(main, detect) || main.Id == detect.Id)
        {
            return
            [
                new FrigateInputConfig
                {
                    Path = BuildStreamUrl(camera, main, frigateKey),
                    Roles = ["detect", "record"],
                }
            ];
        }

        return
        [
            new FrigateInputConfig { Path = BuildStreamUrl(camera, detect, frigateKey), Roles = ["detect"] },
            new FrigateInputConfig { Path = BuildStreamUrl(camera, main, frigateKey), Roles = ["record"] },
        ];
    }

    // The streams Frigate will actually consume — one when both roles share a stream, two otherwise.
    private static IEnumerable<CameraStream?> DistinctRoleStreams(Camera camera)
    {
        var main = camera.MainStream;
        var detect = camera.DetectStream;

        yield return main;
        if (main is not null && detect is not null && main.Id != detect.Id)
            yield return detect;
    }

    // DVRIP streams reach Frigate through go2rtc, so their name has to stay stable and unique per
    // role-carrying stream; RTSP streams are addressed directly on the camera.
    private static string BuildStreamUrl(Camera camera, CameraStream? stream, string frigateKey)
        => camera.StreamProtocol == StreamProtocol.Dvrip
            ? $"rtsp://127.0.0.1:8554/{Go2rtcStreamName(frigateKey, stream)}"
            : BuildRtspUrl(camera, stream?.Path);

    // Rank 0 keeps the plain camera name so existing go2rtc entries and recordings are untouched;
    // lighter ranks get a suffixed bridge of their own.
    private static string Go2rtcStreamName(string frigateKey, CameraStream? stream)
        => stream is null or { Ordinal: 0 } ? frigateKey : $"{frigateKey}_{stream.Ordinal}";

    private static string BuildDvripUrl(Camera camera, CameraStream? stream)
    {
        var builder = new UriBuilder("dvrip", camera.Host, camera.Port);
        if (!string.IsNullOrWhiteSpace(camera.Username))
        {
            builder.UserName = camera.Username;
            builder.Password = camera.Password ?? string.Empty;
        }

        // The DVRIP sub-stream is selected by query, not by path (`?channel=0&subtype=1`).
        var path = stream?.Path;
        if (!string.IsNullOrWhiteSpace(path))
        {
            builder.Query = path.TrimStart('/', '?');
        }

        return builder.Uri.ToString();
    }

    private static string BuildRtspUrl(Camera camera, string? streamPath)
    {
        var separatorIndex = streamPath?.IndexOf('?') ?? -1;
        var builder = new UriBuilder("rtsp", camera.Host, camera.Port)
        {
            Path = (separatorIndex >= 0 ? streamPath![..separatorIndex] : streamPath)?.TrimStart('/') ?? string.Empty,
            Query = separatorIndex >= 0 ? streamPath![(separatorIndex + 1)..] : string.Empty,
        };

        if (!string.IsNullOrWhiteSpace(camera.Username))
        {
            builder.UserName = camera.Username;
            builder.Password = camera.Password ?? string.Empty;
        }

        return builder.Uri.ToString();
    }

    private sealed class FrigateDocument
    {
        public required FrigateMqttConfig Mqtt { get; init; }
        public required FrigateDatabaseConfig Database { get; init; }
        public FrigateFfmpegGlobalConfig? Ffmpeg { get; init; }
        public required Dictionary<string, FrigateDetectorConfig> Detectors { get; init; }
        public FrigateModelConfig? Model { get; init; }
        public FrigateFaceRecognitionConfig? FaceRecognition { get; init; }
        public FrigateGo2rtcConfig? Go2rtc { get; init; }
        public FrigateRecordConfig? Record { get; init; }
        public required Dictionary<string, FrigateCameraConfig> Cameras { get; init; }
    }

    private sealed class FrigateGo2rtcConfig
    {
        public required Dictionary<string, List<string>> Streams { get; init; }
    }

    private sealed class FrigateMqttConfig
    {
        public required string Host { get; init; }
        public required int Port { get; init; }
    }

    private sealed class FrigateDatabaseConfig
    {
        public required string Path { get; init; }
    }

    // Global ffmpeg section — only carries hardware decoding today; per-camera inputs stay in
    // FrigateFfmpegConfig.
    private sealed class FrigateFfmpegGlobalConfig
    {
        public required string HwaccelArgs { get; init; }
    }

    private sealed class FrigateDetectorConfig
    {
        public required string Type { get; init; }
        public string? Device { get; init; }
    }

    private sealed class FrigateModelConfig
    {
        public string? ModelType { get; init; }
        public required int Width { get; init; }
        public required int Height { get; init; }
        public required string InputTensor { get; init; }
        public string? InputPixelFormat { get; init; }
        public string? InputDtype { get; init; }
        public required string Path { get; init; }
        public required string LabelmapPath { get; init; }
    }

    private sealed class FrigateFaceRecognitionConfig
    {
        public required bool Enabled { get; init; }
    }

    private sealed class FrigateCameraConfig
    {
        public required bool Enabled { get; init; }
        public required FrigateFfmpegConfig Ffmpeg { get; init; }
        public required FrigateDetectConfig Detect { get; init; }
        public FrigateMotionConfig? Motion { get; init; }
        public FrigateObjectsConfig? Objects { get; init; }
        public FrigateSnapshotsConfig? Snapshots { get; init; }
        public FrigateRecordConfig? Record { get; init; }
    }

    // The installation's own retention, at the root of the file — what every camera follows unless
    // it says otherwise. Recording is switched off outright when nothing is kept, which is what
    // finally gives "I want no recordings" an observable effect (ADR-39).
    private static FrigateRecordConfig BuildInstallationRecord(RecordingSettings installation)
    {
        var policy = RetentionPolicy.ForInstallation(installation);

        return new FrigateRecordConfig
        {
            Enabled = policy.KeepsAnything,
            Continuous = new FrigateRetainDaysConfig { Days = policy.ContinuousDays },
            Motion = new FrigateRetainDaysConfig { Days = policy.MotionDays },
            // Frigate splits event clips into alerts and detections. That split belongs to its own
            // review model and means nothing to a non-technical user (principle #1), so one Vyzio
            // duration drives both rather than surfacing the distinction.
            Alerts = BuildEventRecord(policy.EventClipDays),
            Detections = BuildEventRecord(policy.EventClipDays),
        };
    }

    // Only what this camera says differently. The installation values already sit at the root, and
    // repeating them here would make the generated file lie about where a value comes from.
    private static FrigateRecordConfig? BuildCameraRecord(RecordingSettings installation, Camera camera)
    {
        if (camera.ContinuousDaysOverride is null
            && camera.MotionDaysOverride is null
            && camera.EventClipDaysOverride is null)
        {
            return null;
        }

        var policy = RetentionPolicy.Resolve(installation, camera);

        return new FrigateRecordConfig
        {
            Enabled = policy.KeepsAnything,
            Continuous = BuildRetainDays(camera.ContinuousDaysOverride),
            Motion = BuildRetainDays(camera.MotionDaysOverride),
            Alerts = camera.EventClipDaysOverride is { } alertDays ? BuildEventRecord(alertDays) : null,
            Detections = camera.EventClipDaysOverride is { } detectionDays ? BuildEventRecord(detectionDays) : null,
        };
    }

    private static FrigateRetainDaysConfig? BuildRetainDays(int? days)
        => days is { } value ? new FrigateRetainDaysConfig { Days = value } : null;

    private static FrigateEventRecordConfig BuildEventRecord(int days)
        => new() { Retain = new FrigateRetainDaysConfig { Days = days } };

    private sealed class FrigateMotionConfig
    {
        public required int ContourArea { get; init; }
    }

    private sealed class FrigateObjectsConfig
    {
        public required List<string> Track { get; init; }
    }

    private sealed class FrigateFfmpegConfig
    {
        public required List<FrigateInputConfig> Inputs { get; init; }
    }

    private sealed class FrigateInputConfig
    {
        public required string Path { get; init; }
        public required List<string> Roles { get; init; }
    }

    private sealed class FrigateDetectConfig
    {
        public required bool Enabled { get; init; }
        public required int Fps { get; init; }
        public int? Width { get; init; }
        public int? Height { get; init; }
    }

    private sealed class FrigateSnapshotsConfig
    {
        public required bool Enabled { get; init; }
        public bool BoundingBox { get; init; }
        public FrigateRetainConfig? Retain { get; init; }
    }

    private sealed class FrigateRetainConfig
    {
        public required int Default { get; init; }
    }

    // Same shape at the root and under a camera — Frigate accepts the full RecordConfig in both
    // places, so Vyzio's global/override model needs no translation (ADR-39).
    private sealed class FrigateRecordConfig
    {
        public bool? Enabled { get; init; }
        public FrigateRetainDaysConfig? Continuous { get; init; }
        public FrigateRetainDaysConfig? Motion { get; init; }
        public FrigateEventRecordConfig? Alerts { get; init; }
        public FrigateEventRecordConfig? Detections { get; init; }
    }

    private sealed class FrigateRetainDaysConfig
    {
        public required int Days { get; init; }
    }

    private sealed class FrigateEventRecordConfig
    {
        public required FrigateRetainDaysConfig Retain { get; init; }
    }
}