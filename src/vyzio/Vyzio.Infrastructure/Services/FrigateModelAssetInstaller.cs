using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

// Copies the models bundled in the image into Frigate's model cache, once, so Frigate never downloads them (ADR-34, ADR-70).
public sealed class FrigateModelAssetInstaller : IFrigateModelAssetInstaller
{
    private const string DefaultBundledModelsDirectory = "/app/models";

    // Only the Intel GPU tier needs a model Frigate does not carry: YOLOX overloads the CPU-only tier (ADR-34).
    private static readonly IReadOnlyDictionary<FrigateDetectorKind, string> DetectorModelFiles = new Dictionary<FrigateDetectorKind, string>
    {
        [FrigateDetectorKind.Openvino] = "yolox_s.onnx",
    };

    // Where Frigate's small face model looks for its files, relative to its model cache (ADR-70).
    internal static readonly IReadOnlyList<string> FaceRecognitionModelFiles =
    [
        Path.Combine("facedet", "facedet.onnx"),
        Path.Combine("facedet", "landmarkdet.yaml"),
        Path.Combine("facedet", "facenet.tflite"),
    ];

    private const UnixFileMode SharedDirectoryMode =
        UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute |
        UnixFileMode.GroupRead | UnixFileMode.GroupWrite | UnixFileMode.GroupExecute |
        UnixFileMode.OtherRead | UnixFileMode.OtherWrite | UnixFileMode.OtherExecute;

    private const UnixFileMode SharedFileMode =
        UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.GroupRead | UnixFileMode.OtherRead;

    private readonly ILogger<FrigateModelAssetInstaller> _logger;
    private readonly string _bundledModelsDirectory;

    public FrigateModelAssetInstaller(ILogger<FrigateModelAssetInstaller> logger)
        : this(logger, DefaultBundledModelsDirectory)
    {
    }

    internal FrigateModelAssetInstaller(ILogger<FrigateModelAssetInstaller> logger, string bundledModelsDirectory)
    {
        _logger = logger;
        _bundledModelsDirectory = bundledModelsDirectory;
    }

    public async Task EnsureInstalledAsync(FrigateDetectorKind detectorKind, string configDirectory, CancellationToken ct = default)
    {
        var modelCacheDirectory = Path.Combine(configDirectory, "model_cache");
        Directory.CreateDirectory(modelCacheDirectory);
        TrySetUnixFileMode(modelCacheDirectory, SharedDirectoryMode);

        if (DetectorModelFiles.TryGetValue(detectorKind, out var detectorModel))
            await InstallAsync(detectorModel, modelCacheDirectory, ct);

        foreach (var faceModel in FaceRecognitionModelFiles)
            await InstallAsync(faceModel, modelCacheDirectory, ct);
    }

    private async Task InstallAsync(string relativePath, string modelCacheDirectory, CancellationToken ct)
    {
        var destinationPath = Path.Combine(modelCacheDirectory, relativePath);
        var destinationDirectory = Path.GetDirectoryName(destinationPath)!;
        Directory.CreateDirectory(destinationDirectory);
        // Shared with Frigate (root): a best-effort top-up of what the entrypoint reclaims at startup.
        TrySetUnixFileMode(destinationDirectory, SharedDirectoryMode);

        if (File.Exists(destinationPath))
            return;

        var sourcePath = Path.Combine(_bundledModelsDirectory, relativePath);
        // Frigate only checks that the file exists, so it must never see a partial copy.
        var partialPath = $"{destinationPath}.part";
        await using (var source = File.OpenRead(sourcePath))
        await using (var destination = File.Create(partialPath))
        {
            await source.CopyToAsync(destination, ct);
        }

        File.Move(partialPath, destinationPath, overwrite: true);
        TrySetUnixFileMode(destinationPath, SharedFileMode);
    }

    private void TrySetUnixFileMode(string path, UnixFileMode mode)
    {
        if (OperatingSystem.IsWindows())
            return;

        try
        {
            File.SetUnixFileMode(path, mode);
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or IOException)
        {
            _logger.LogWarning(ex, "Could not set permissions on {Path}, likely owned by another user; continuing.", path);
        }
    }
}
