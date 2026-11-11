namespace Vyzio.Application.DTOs.DetectionEvents;

/// <summary>
/// A detection as the screens read it. <paramref name="EventId"/> is Frigate's — Vyzio holds no id
/// of its own for a detection (ADR-49).
/// </summary>
/// <param name="MediaExpired">
/// The detection is older than what its camera keeps: its media is gone, and that is a setting
/// doing its job rather than a failure (ADR-48). Screens only — never the notification path.
/// </param>
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
    bool HasSnapshot,
    bool MediaExpired);
