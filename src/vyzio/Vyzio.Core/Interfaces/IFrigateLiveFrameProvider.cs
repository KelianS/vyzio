namespace Vyzio.Core.Interfaces;

public interface IFrigateLiveFrameProvider
{
    /// <summary>
    /// Fetches the latest frame of a camera as JPEG bytes (ADR-16).
    /// Returns null when the frame is not available or the request fails.
    /// </summary>
    Task<byte[]?> TryGetLatestFrameAsync(string frigateCameraName, CancellationToken ct = default);
}
