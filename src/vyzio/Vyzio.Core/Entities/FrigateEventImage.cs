namespace Vyzio.Core.Entities;

/// <summary>
/// The two images Frigate writes for an event. Neither is a resize of the other: a tile wants the
/// crop, a notification wants the context (ADR-49).
/// </summary>
public enum FrigateEventImage
{
    /// <summary>Full frame, ~130 KB — what makes a notification readable.</summary>
    Snapshot,

    /// <summary>Frigate's crop around the object, 175x175 and ~8 KB — what a list tile needs.</summary>
    Thumbnail
}
