using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Extensions.Logging;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Configuration;

namespace Vyzio.Infrastructure.Services;

public sealed class FrigateConfigApplier(
    VyzioRuntimeSettings settings,
    ILogger<FrigateConfigApplier> logger,
    IFrigateRestartTracker restartTracker,
    IFrigateDetectorPlanner detectorPlanner) : IFrigateConfigApplier
{
    public async Task WriteConfigAsync(IReadOnlyList<Camera> cameras, CancellationToken ct = default)
    {
        var configPath = settings.Frigate.ConfigPath;
        if (string.IsNullOrWhiteSpace(configPath))
            return;

        var serializer = new SerializerBuilder()
            .WithNamingConvention(UnderscoredNamingConvention.Instance)
            .ConfigureDefaultValuesHandling(DefaultValuesHandling.OmitNull)
            .Build();

        var yaml = serializer.Serialize(BuildDocument(cameras));
        var directory = Path.GetDirectoryName(configPath);
        if (!string.IsNullOrWhiteSpace(directory))
            Directory.CreateDirectory(directory);

        var tempPath = $"{configPath}.tmp";
        await File.WriteAllTextAsync(tempPath, yaml, ct);
        File.Move(tempPath, configPath, true);
    }

    public async Task<FrigateConfigApplyResult> ApplyAsync(IReadOnlyList<Camera> cameras, CancellationToken ct = default)
    {
        var configPath = settings.Frigate.ConfigPath;

        if (string.IsNullOrWhiteSpace(configPath))
        {
            return new FrigateConfigApplyResult(false, "Frigate config path is not configured.", string.Empty);
        }

        await WriteConfigAsync(cameras, ct);

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

        return process.ExitCode == 0
            ? new FrigateConfigApplyResult(true, "Frigate configuration applied successfully.", configPath)
            : new FrigateConfigApplyResult(false, string.IsNullOrWhiteSpace(standardError) ? "Frigate apply command failed." : standardError.Trim(), configPath);
    }

    private FrigateDocument BuildDocument(IReadOnlyList<Camera> cameras)
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
                    var isDvrip = camera.StreamProtocol == StreamProtocol.Dvrip;
                    var labels = camera.GetDetectionLabels();
                    // face must be tracked whenever person is — Frigate needs it for face recognition.
                    var frigateLabels = labels.Contains("person")
                        ? labels.Union(["face"], StringComparer.OrdinalIgnoreCase).ToList()
                        : labels;
                    return new FrigateCameraConfig
                    {
                        Enabled = !camera.PrivacyModeActive,
                        Ffmpeg = new FrigateFfmpegConfig
                        {
                            Inputs =
                            [
                                new FrigateInputConfig
                                {
                                    Path = isDvrip ? $"rtsp://127.0.0.1:8554/{frigateKey}" : BuildRtspPath(camera),
                                    Roles = ["detect"],
                                }
                            ]
                        },
                        Detect = new FrigateDetectConfig
                        {
                            Enabled = true,
                            Fps = detectFps,
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
                        Record = camera.ContinuousRecordingEnabled
                            ? new FrigateCameraRecordConfig { Enabled = true }
                            : null,
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

        // Build go2rtc section for DVRIP cameras — go2rtc bridges dvrip:// → rtsp://127.0.0.1:8554/{slug}
        var dvripStreams = cameras
            .Where(c => c.IsEnabled && string.Equals(c.ValidationState, "validated", StringComparison.OrdinalIgnoreCase))
            .Where(c => c.StreamProtocol == StreamProtocol.Dvrip)
            .ToDictionary(
                c => c.FrigateCameraName ?? c.Slug.Replace('-', '_'),
                c => new List<string> { BuildDvripUrl(c) },
                StringComparer.OrdinalIgnoreCase);

        FrigateGo2rtcConfig? go2rtc = dvripStreams.Count > 0
            ? new FrigateGo2rtcConfig { Streams = dvripStreams }
            : null;

        // Enable face_recognition globally when at least one active camera is configured
        FrigateFaceRecognitionConfig? faceRecognition = activeCameras.Any(c => c.Value.Enabled)
            ? new FrigateFaceRecognitionConfig { Enabled = true }
            : null;

        return new FrigateDocument
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
            Detectors = BuildDetectors(detectorKind),
            Model = BuildModel(detectorKind),
            FaceRecognition = faceRecognition,
            Go2rtc = go2rtc,
            Record = new FrigateRecordConfig { Enabled = true },
            Cameras = activeCameras,
        };
    }

    private static Dictionary<string, FrigateDetectorConfig> BuildDetectors(FrigateDetectorKind detectorKind) =>
        detectorKind switch
        {
            FrigateDetectorKind.EdgeTpu => new Dictionary<string, FrigateDetectorConfig>
            {
                ["coral"] = new() { Type = "edgetpu", Device = "pci" }
            },
            FrigateDetectorKind.Openvino => new Dictionary<string, FrigateDetectorConfig>
            {
                ["ov"] = new() { Type = "openvino", Device = "GPU" }
            },
            // Frigate discourages its native `cpu` detector ("not recommended for general use") in
            // favor of the OpenVINO detector running in CPU mode, even without GPU/TPU hardware
            // (ADR-34) — same detector type as the GPU tier, only the device differs.
            FrigateDetectorKind.Cpu => new Dictionary<string, FrigateDetectorConfig>
            {
                ["ov"] = new() { Type = "openvino", Device = "CPU" }
            },
            _ => throw new ArgumentOutOfRangeException(nameof(detectorKind), detectorKind, null),
        };

    // OpenVINO (GPU or CPU device) crashes at startup with `model.path` unset (Frigate 0.17.1:
    // `TypeError: stat: path should be string... not NoneType`) — no working implicit default in
    // practice, despite the docs suggesting one exists (ADR-34). EdgeTpu ships its own default
    // tflite model and needs no model block.
    private static FrigateModelConfig? BuildModel(FrigateDetectorKind detectorKind) =>
        detectorKind == FrigateDetectorKind.EdgeTpu
            ? null
            : new FrigateModelConfig
            {
                Width = 300,
                Height = 300,
                InputTensor = "nhwc",
                InputPixelFormat = "bgr",
                Path = "/openvino-model/ssdlite_mobilenet_v2.xml",
                LabelmapPath = "/openvino-model/coco_91cl_bkgr.txt",
            };

    private static string BuildDvripUrl(Camera camera)
    {
        var builder = new UriBuilder("dvrip", camera.Host, camera.Port);
        if (!string.IsNullOrWhiteSpace(camera.Username))
        {
            builder.UserName = camera.Username;
            builder.Password = camera.Password ?? string.Empty;
        }
        return builder.Uri.ToString();
    }

    private static string BuildRtspPath(Camera camera)
    {
        var builder = new UriBuilder("rtsp", camera.Host, camera.Port)
        {
            Path = camera.StreamPath?.TrimStart('/') ?? string.Empty,
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

    private sealed class FrigateDetectorConfig
    {
        public required string Type { get; init; }
        public string? Device { get; init; }
    }

    private sealed class FrigateModelConfig
    {
        public required int Width { get; init; }
        public required int Height { get; init; }
        public required string InputTensor { get; init; }
        public required string InputPixelFormat { get; init; }
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
        public FrigateObjectsConfig? Objects { get; init; }
        public FrigateSnapshotsConfig? Snapshots { get; init; }
        public FrigateCameraRecordConfig? Record { get; init; }
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

    private sealed class FrigateRecordConfig
    {
        public required bool Enabled { get; init; }
    }

    // Per-camera record override: only sets enabled; global retain/events apply otherwise.
    private sealed class FrigateCameraRecordConfig
    {
        public required bool Enabled { get; init; }
    }
}