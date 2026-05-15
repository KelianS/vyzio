using System.Diagnostics;
using System.Runtime.InteropServices;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Configuration;

namespace Vyzio.Infrastructure.Services;

public sealed class FrigateConfigApplier(VyzioRuntimeSettings settings) : IFrigateConfigApplier
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
                camera => new FrigateCameraConfig
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
                    Snapshots = new FrigateSnapshotsConfig
                    {
                        Enabled = true,
                        BoundingBox = true,
                        Retain = new FrigateRetainConfig { Default = 30 },
                    }
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

    private sealed class FrigateCameraConfig
    {
        public required bool Enabled { get; init; }
        public required FrigateFfmpegConfig Ffmpeg { get; init; }
        public required FrigateDetectConfig Detect { get; init; }
        public FrigateSnapshotsConfig? Snapshots { get; init; }
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
}