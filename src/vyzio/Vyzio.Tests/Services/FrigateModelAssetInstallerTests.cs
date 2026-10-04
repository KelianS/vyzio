using Microsoft.Extensions.Logging.Abstractions;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Services;

namespace Vyzio.Tests.Services;

public sealed class FrigateModelAssetInstallerTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), $"frigate_models_{Guid.NewGuid():N}");
    private string BundledDirectory => Path.Combine(_root, "bundled");
    private string ConfigDirectory => Path.Combine(_root, "config");

    public FrigateModelAssetInstallerTests()
    {
        foreach (var file in FrigateModelAssetInstaller.FaceRecognitionModelFiles.Append("yolox_s.onnx"))
        {
            var path = Path.Combine(BundledDirectory, file);
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(path, $"bundled {Path.GetFileName(file)}");
        }
    }

    public void Dispose()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
    }

    private FrigateModelAssetInstaller BuildInstaller() =>
        new(NullLogger<FrigateModelAssetInstaller>.Instance, BundledDirectory);

    private string CachePath(string relativePath) => Path.Combine(ConfigDirectory, "model_cache", relativePath);

    [Theory]
    [InlineData("facedet/facedet.onnx")]
    [InlineData("facedet/landmarkdet.yaml")]
    [InlineData("facedet/facenet.tflite")]
    public async Task EnsureInstalledAsync_ShouldPutEachFaceModelWhereFrigateLooksForIt_WhenTheCacheIsEmpty(string frigatePath)
    {
        // Arrange
        var installer = BuildInstaller();

        // Act
        await installer.EnsureInstalledAsync(FrigateDetectorKind.Cpu, ConfigDirectory);

        // Assert
        Assert.Equal($"bundled {Path.GetFileName(frigatePath)}", await File.ReadAllTextAsync(CachePath(frigatePath)));
    }

    [Fact]
    public async Task EnsureInstalledAsync_ShouldLeaveTheFileInPlace_WhenFrigateAlreadyHasIt()
    {
        // Arrange
        var existing = CachePath("facedet/facenet.tflite");
        Directory.CreateDirectory(Path.GetDirectoryName(existing)!);
        await File.WriteAllTextAsync(existing, "already there");
        var installer = BuildInstaller();

        // Act
        await installer.EnsureInstalledAsync(FrigateDetectorKind.Cpu, ConfigDirectory);

        // Assert
        Assert.Equal("already there", await File.ReadAllTextAsync(existing));
    }

    [Fact]
    public async Task EnsureInstalledAsync_ShouldReplaceTheLeftoverPartialCopy_WhenAnEarlierCopyWasInterrupted()
    {
        // Arrange
        var target = CachePath("facedet/landmarkdet.yaml");
        Directory.CreateDirectory(Path.GetDirectoryName(target)!);
        await File.WriteAllTextAsync($"{target}.part", "interrupted");
        var installer = BuildInstaller();

        // Act
        await installer.EnsureInstalledAsync(FrigateDetectorKind.Cpu, ConfigDirectory);

        // Assert
        Assert.Equal("bundled landmarkdet.yaml", await File.ReadAllTextAsync(target));
        Assert.False(File.Exists($"{target}.part"));
    }

    [Fact]
    public async Task EnsureInstalledAsync_ShouldSkipTheModel_WhenItIsNotBundled()
    {
        // Arrange
        File.Delete(Path.Combine(BundledDirectory, "facedet", "facenet.tflite"));
        var installer = BuildInstaller();

        // Act
        await installer.EnsureInstalledAsync(FrigateDetectorKind.Cpu, ConfigDirectory);

        // Assert
        Assert.False(File.Exists(CachePath("facedet/facenet.tflite")));
        Assert.True(File.Exists(CachePath("facedet/facedet.onnx")));
    }

    [Fact]
    public async Task EnsureInstalledAsync_ShouldInstallTheYoloxModel_WhenTheIntelGpuTierIsPicked()
    {
        // Arrange
        var installer = BuildInstaller();

        // Act
        await installer.EnsureInstalledAsync(FrigateDetectorKind.Openvino, ConfigDirectory);

        // Assert
        Assert.True(File.Exists(CachePath("yolox_s.onnx")));
    }

    [Theory]
    [InlineData(FrigateDetectorKind.Cpu)]
    [InlineData(FrigateDetectorKind.EdgeTpu)]
    public async Task EnsureInstalledAsync_ShouldInstallNoDetectorModel_WhenTheTierUsesFrigatesOwn(FrigateDetectorKind detectorKind)
    {
        // Arrange
        var installer = BuildInstaller();

        // Act
        await installer.EnsureInstalledAsync(detectorKind, ConfigDirectory);

        // Assert
        Assert.False(File.Exists(CachePath("yolox_s.onnx")));
    }
}
