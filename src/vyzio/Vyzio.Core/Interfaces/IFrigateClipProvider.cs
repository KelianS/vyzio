namespace Vyzio.Core.Interfaces;

public interface IFrigateClipProvider
{
    /// <summary>
    /// Fetches the clip video for a Frigate event.
    /// Returns null when the clip is not available or the request fails.
    /// </summary>
    /// <param name="finalizationWindow">
    /// How long the read keeps retrying while Frigate has not written the file yet (ADR-49).
    /// Zero — the default — reads once, which is what a screen asking for an old event wants.
    /// </param>
    Task<Stream?> TryGetClipAsync(
        string frigateEventId, TimeSpan finalizationWindow = default, CancellationToken ct = default);
}
