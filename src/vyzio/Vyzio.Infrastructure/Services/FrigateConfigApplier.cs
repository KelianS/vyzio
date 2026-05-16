using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Extensions.Logging;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Configuration;

namespace Vyzio.Infrastructure.Services;

public sealed class FrigateConfigApplier(VyzioRuntimeSettings settings, ILogger<FrigateConfigApplier> logger) : IFrigateConfigApplier
{
    public async Task<FrigateConfigApplyResult> ApplyAsync(IReadOnlyList<Camera> cameras, CancellationToken ct = default)
    {
        var configPath = settings.Frigate.ConfigPath;

        if (string.IsNullOrWhiteSpace(configPath))
        {
            return new FrigateConfigApplyResult(false, "Frigate config path is not configured.", string.Empty);
        }

        var serializer = new SerializerBuilder()
            .WithNamingConvention(UnderscoredNamingConvention.Instance)
            .ConfigureDefaultValuesHandling(DefaultValuesHandling.OmitNull)
            .Build();

        var yaml = serializer.Serialize(BuildDocument(cameras));
        var directory = Path.GetDirectoryName(configPath);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        var tempPath = $"{configPath}.tmp";
        await File.WriteAllTextAsync(tempPath, yaml, ct);
        File.Move(tempPath, configPath, true);

        if (string.IsNullOrWhiteSpace(settings.Frigate.ApplyCommand))
        {
            return new FrigateConfigApplyResult(false, "Frigate apply command is not configured.", configPath);
        }

        var (fileName, arguments) = RuntimeInformation.IsOSPlatform(OSPlatform.Windows)
            ? ("cmd.exe", $"/c {settings.Frigate.ApplyCommand}")
            : ("/bin/sh", $"-lc \"{settings.Frigate.ApplyCommand.Replace("\"", "\\\"")}\"");

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
        var activeCameras = cameras
            .Where(camera => camera.IsEnabled)
            .Where(camera => string.Equals(camera.ValidationState, "validated", StringComparison.OrdinalIgnoreCase))
            .ToDictionary(
                camera => camera.FrigateCameraName ?? camera.Slug.Replace('-', '_'),
                camera =>
                {
                    var labels = camera.GetDetectionLabels();
                    return new FrigateCameraConfig
                    {
                        Enabled = true,
                        Ffmpeg = new FrigateFfmpegConfig
                        {
                            Inputs =
                            [
                                new FrigateInputConfig
                                {
                                    Path = BuildRtspPath(camera),
                                    Roles = ["detect"],
                                }
                            ]
                        },
                        Detect = new FrigateDetectConfig
                        {
                            Enabled = true,
                            Fps = 5,
                        },
                        Objects = new FrigateObjectsConfig
                        {
                            Track = [.. labels],
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
                    Fps = 5,
                }
            };
        }

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
            Detectors = new Dictionary<string, FrigateDetectorConfig>
            {
                ["cpu1"] = new() { Type = "cpu" }
            },
            FaceRecognition = faceRecognition,
            Record = new FrigateRecordConfig
            {
                Enabled = true,
                Retain = new FrigateRecordRetainConfig { Days = 7, Mode = "motion" },
                Events = new FrigateRecordEventsConfig
                {
                    Retain = new FrigateRetainConfig { Default = 14 },
                },
            },
            Cameras = activeCameras,
        };
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
        public FrigateFaceRecognitionConfig? FaceRecognition { get; init; }
        public FrigateRecordConfig? Record { get; init; }
        public required Dictionary<string, FrigateCameraConfig> Cameras { get; init; }
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
        public FrigateRecordRetainConfig? Retain { get; init; }
        public FrigateRecordEventsConfig? Events { get; init; }
    }

    private sealed class FrigateRecordRetainConfig
    {
        public required int Days { get; init; }
        public string Mode { get; init; } = "motion";
    }

    private sealed class FrigateRecordEventsConfig
    {
        public FrigateRetainConfig? Retain { get; init; }
    }

    // Per-camera record override: only sets enabled; global retain/events apply otherwise.
    private sealed class FrigateCameraRecordConfig
    {
        public required bool Enabled { get; init; }
    }
}