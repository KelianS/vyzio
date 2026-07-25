using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

// YOLOX (Apache-2.0 — no redistribution concern, unlike YOLOv9's GPL-3.0, ADR-34) is bundled into the
// vyzio-api image at build time (Vyzio.Api/Dockerfile) under BundledModelsDirectory. Frigate runs in a
// separate container and only shares the config volume, so the relevant file is copied there once,
// on demand — not on every config write. Only the Openvino/Intel-GPU tier uses it: field testing
// showed even the smallest YOLOX variant overloads the CPU-only tier (ADR-34).
public sealed class FrigateModelAssetInstaller : IFrigateModelAssetInstaller
{
    private const string BundledModelsDirectory = "/app/models";

    private static readonly IReadOnlyDictionary<FrigateDetectorKind, string> ModelFileNames = new Dictionary<FrigateDetectorKind, string>
    {
        [FrigateDetectorKind.Openvino] = "yolox_s.onnx",
    };

    public async Task EnsureInstalledAsync(FrigateDetectorKind detectorKind, string configDirectory, CancellationToken ct = default)
    {
        if (!ModelFileNames.TryGetValue(detectorKind, out var fileName))
            return;

        var modelCacheDirectory = Path.Combine(configDirectory, "model_cache");
        Directory.CreateDirectory(modelCacheDirectory);
        // frigate (privileged, runs as root) shares this volume with vyzio-api (non-root) — keep the
        // directory writable by both regardless of which container creates it first.
        if (!OperatingSystem.IsWindows())
            File.SetUnixFileMode(modelCacheDirectory,
                UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute |
                UnixFileMode.GroupRead | UnixFileMode.GroupWrite | UnixFileMode.GroupExecute |
                UnixFileMode.OtherRead | UnixFileMode.OtherWrite | UnixFileMode.OtherExecute);

        var destinationPath = Path.Combine(modelCacheDirectory, fileName);
        if (File.Exists(destinationPath))
            return;

        var sourcePath = Path.Combine(BundledModelsDirectory, fileName);
        await using var source = File.OpenRead(sourcePath);
        await using var destination = File.Create(destinationPath);
        await source.CopyToAsync(destination, ct);

        if (!OperatingSystem.IsWindows())
            File.SetUnixFileMode(destinationPath, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.GroupRead | UnixFileMode.OtherRead);
    }
}
