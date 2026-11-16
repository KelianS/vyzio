namespace Vyzio.Core.Entities;

/// <summary>
/// A detection as Frigate holds it. Vyzio never persists one (ADR-12).
/// </summary>
public sealed record FrigateDetection(
    string EventId,
    string Camera,
    string Label,
    string? Identity,
    float? Confidence,
    DateTimeOffset OccurredAt,
    bool HasClip,
    bool HasSnapshot,
    DateTimeOffset? StartedAt = null);

/// <summary>
/// Frigate paginates by time, not by page number — its `page=` parameter is inert (ADR-12).
/// <paramref name="Before"/> is the cursor: the occurrence time of the last detection already read.
/// Each list keeps a detection matching any of its values; an empty or missing one filters nothing.
/// </summary>
public sealed record FrigateDetectionQuery(
    IReadOnlyList<string>? Cameras = null,
    IReadOnlyList<string>? Labels = null,
    IReadOnlyList<string>? Identities = null,
    DateTimeOffset? After = null,
    DateTimeOffset? Before = null,
    int Limit = 20);
