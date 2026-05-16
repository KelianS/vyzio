namespace Vyzio.Core.Interfaces;

public interface IFrigateClipProvider
{
    /// <summary>
    /// Fetches the clip video for a Frigate event.
    /// Returns null when the clip is not available or the request fails.
    /// </summary>
    Task<Stream?> TryGetClipAsync(string frigateEventId, CancellationToken ct = default);
}
