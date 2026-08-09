namespace Vyzio.Core.Entities;

/// <summary>
/// <paramref name="Cursor"/> is the occurrence time of the last detection already read, as unix
/// milliseconds. Frigate paginates by time — its `page=` parameter is inert (ADR-49).
/// </summary>
public sealed record DetectionHistoryQuery(
    string? Camera = null,
    string? Label = null,
    string? ProfileId = null,
    DateTimeOffset? From = null,
    DateTimeOffset? To = null,
    string? Cursor = null,
    int Limit = 20);
