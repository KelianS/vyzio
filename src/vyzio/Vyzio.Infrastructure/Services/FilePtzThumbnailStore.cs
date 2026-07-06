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

    private string FilePath(string cameraId, int presetId)
        => Path.Combine(_directory, $"{cameraId}-{presetId}.jpg");
}
