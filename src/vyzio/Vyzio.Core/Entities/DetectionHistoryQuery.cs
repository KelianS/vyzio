namespace Vyzio.Core.Entities;

/// <summary>
/// <paramref name="Cursor"/> is the occurrence time of the last detection already read, as unix
/// milliseconds. Frigate paginates by time — its `page=` parameter is inert (ADR-12).
/// Each list keeps a detection matching any of its values; an empty or missing one filters nothing.
/// </summary>
public sealed record DetectionHistoryQuery(
    IReadOnlyList<string>? Cameras = null,
    IReadOnlyList<string>? Labels = null,
    IReadOnlyList<string>? ProfileIds = null,
    DateTimeOffset? From = null,
    DateTimeOffset? To = null,
    string? Cursor = null,
    int Limit = 20);
