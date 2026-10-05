using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

public sealed class FilePtzThumbnailStore : IPtzThumbnailStore
{
    private readonly string _directory;

    public FilePtzThumbnailStore(string directory)
    {
        _directory = directory;
        Directory.CreateDirectory(directory);
    }

    public async Task SaveAsync(string cameraId, int presetId, byte[] jpeg, CancellationToken ct = default)
        => await File.WriteAllBytesAsync(FilePath(cameraId, presetId), jpeg, ct);

    public Task<Stream?> TryGetAsync(string cameraId, int presetId, CancellationToken ct = default)
    {
        var path = FilePath(cameraId, presetId);
        return Task.FromResult<Stream?>(File.Exists(path) ? File.OpenRead(path) : null);
    }

    public Task<bool> ExistsAsync(string cameraId, int presetId, CancellationToken ct = default)
        => Task.FromResult(File.Exists(FilePath(cameraId, presetId)));

    public Task DeleteAsync(string cameraId, int presetId, CancellationToken ct = default)
    {
        File.Delete(FilePath(cameraId, presetId));
        return Task.CompletedTask;
    }

    private string FilePath(string cameraId, int presetId)
        => Path.Combine(_directory, $"{cameraId}-{presetId}.jpg");
}
