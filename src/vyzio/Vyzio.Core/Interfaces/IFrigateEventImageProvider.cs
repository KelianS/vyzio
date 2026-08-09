using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IFrigateEventImageProvider
{
    /// <summary>
    /// Fetches one of the images Frigate wrote for an event.
    /// Returns null when the image is not available or the request fails.
    /// </summary>
    /// <param name="finalizationWindow">
    /// How long the read keeps retrying while Frigate has not written the file yet (ADR-49).
    /// Zero — the default — reads once, which is what a screen asking for an old event wants.
    /// </param>
    Task<Stream?> TryGetImageAsync(
        string frigateEventId,
        FrigateEventImage image,
        TimeSpan finalizationWindow = default,
        CancellationToken ct = default);
}
