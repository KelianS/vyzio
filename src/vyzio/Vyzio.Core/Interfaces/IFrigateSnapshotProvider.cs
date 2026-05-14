namespace Vyzio.Core.Interfaces;

public interface IFrigateSnapshotProvider
{
    /// <summary>
    /// Fetches the snapshot image for a Frigate event.
    /// Returns null when the snapshot is not available or the request fails.
    /// </summary>
    Task<Stream?> TryGetSnapshotAsync(string frigateEventId, CancellationToken ct = default);
}
