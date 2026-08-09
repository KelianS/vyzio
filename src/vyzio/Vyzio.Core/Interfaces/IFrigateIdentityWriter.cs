namespace Vyzio.Core.Interfaces;

/// <summary>
/// Writes a corrected identity back to Frigate, which owns it (ADR-49). A correction kept locally
/// would teach the engine nothing.
/// </summary>
public interface IFrigateIdentityWriter
{
    /// <summary>
    /// Attributes <paramref name="identity"/> to an event, or clears it when null.
    /// Returns false when Frigate refuses — an unknown event, or an unreachable one.
    /// Propagation takes a few seconds: a read that follows immediately still answers the old value.
    /// </summary>
    Task<bool> TrySetIdentityAsync(string frigateEventId, string? identity, CancellationToken ct = default);
}
