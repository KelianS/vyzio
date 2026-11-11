using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

/// <summary>
/// Erases one detection from Frigate, which owns it (ADR-49), through its API only.
/// </summary>
public interface IFrigateDetectionEraser
{
    /// <summary>
    /// Erases the review item, which takes the overlapping recording with it, then the event (HIST-10).
    /// The event goes last so that a retry after a partial failure still finds it and finishes.
    /// Throws <see cref="DetectionErasureFailedException"/> when Frigate refuses or does not answer.
    /// </summary>
    Task<DetectionErasure> EraseAsync(string frigateEventId, CancellationToken ct = default);
}

/// <summary>
/// Frigate refused or did not answer mid-erasure; the message says which call and what was already
/// erased, for support (HIST-14).
/// </summary>
public sealed class DetectionErasureFailedException(string message, bool partlyErased, Exception? inner = null)
    : Exception(message, inner)
{
    /// <summary>Something is already gone, so a retry finishes the work rather than starts it.</summary>
    public bool PartlyErased { get; } = partlyErased;
}
