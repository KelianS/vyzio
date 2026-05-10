namespace Vyzio.Application.DTOs.DetectionEvents;

public sealed record DetectionEventContract(
    string EventId,
    string FrigateEventId,
    string Lifecycle,
    string Camera,
    string Label,
    string? Identity,
    string? ProfileId,
    float? Confidence,
    DateTimeOffset OccurredAt,
    bool HasClip,
    bool HasSnapshot);