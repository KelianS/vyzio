namespace Vyzio.Core.Interfaces;

public interface IFrigateClipProvider
{
    /// <summary>
    /// Fetches the clip video for a Frigate event.
    /// Returns null when the clip is not available or the request fails.
    /// </summary>
    /// <param name="finalizationWindow">
    /// How long the read keeps retrying while Frigate has not written the file yet (ADR-12).
    /// Zero — the default — reads once, which is what a screen asking for an old event wants.
    /// </param>
    Task<Stream?> TryGetClipAsync(
        string frigateEventId, TimeSpan finalizationWindow = default, CancellationToken ct = default);

    /// <summary>
    /// Reads the clip once for a viewer. Returns null only when Frigate says the clip does not exist,
    /// such as one erased with another detection (HIST-11); throws
    /// <see cref="FrigateClipUnreadableException"/> when Frigate fails or does not answer.
    /// </summary>
    Task<Stream?> ReadClipAsync(string frigateEventId, CancellationToken ct = default);
}

/// <summary>Frigate could not serve a clip it may still hold; the message is support detail (UI-01).</summary>
public sealed class FrigateClipUnreadableException(string message, Exception? inner = null)
    : Exception(message, inner);
