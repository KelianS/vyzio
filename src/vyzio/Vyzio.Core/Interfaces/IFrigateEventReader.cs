namespace Vyzio.Core.Interfaces;

/// <summary>
/// Reads detection events from Frigate, which owns them (ADR-49).
/// </summary>
public interface IFrigateEventReader
{
    /// <summary>
    /// Returns the identity Frigate attributes to an event, or null when it recognized nobody.
    /// </summary>
    Task<string?> TryGetIdentityAsync(string frigateEventId, CancellationToken ct = default);
}
