namespace Vyzio.Application.DTOs.DetectionEvents;

/// <summary>
/// A detection as the screens read it. <paramref name="EventId"/> is Frigate's — Vyzio holds no id
/// of its own for a detection (ADR-49).
/// </summary>
public sealed record DetectionEventContract(
    string EventId,
    string Camera,
    string CameraName,
    string Label,
    string? Identity,
    string? ProfileId,
    float? Confidence,
    DateTimeOffset OccurredAt,
    bool HasClip,
    bool HasSnapshot);
