namespace Vyzio.Core.Interfaces;

public interface IPtzThumbnailStore
{
    Task SaveAsync(string cameraId, int presetId, byte[] jpeg, CancellationToken ct = default);
    Task<Stream?> TryGetAsync(string cameraId, int presetId, CancellationToken ct = default);
}
