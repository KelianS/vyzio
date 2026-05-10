using System.Text.Json.Serialization;

namespace Vyzio.Application.DTOs.Frigate;

public sealed record FrigateEventEnvelope(
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("before")] FrigateTrackedObject? Before,
    [property: JsonPropertyName("after")] FrigateTrackedObject? After);

public sealed record FrigateTrackedObject(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("camera")] string Camera,
    [property: JsonPropertyName("label")] string Label,
    [property: JsonPropertyName("top_score")] float? TopScore,
    [property: JsonPropertyName("start_time")] double? StartTime,
    [property: JsonPropertyName("end_time")] double? EndTime,
    [property: JsonPropertyName("has_clip")] bool HasClip,
    [property: JsonPropertyName("has_snapshot")] bool HasSnapshot,
    [property: JsonPropertyName("entered_zones")] IReadOnlyList<string>? EnteredZones);

public sealed record FrigateConsumedEvent(
    string FrigateEventId,
    string Lifecycle,
    string Camera,
    string Label,
    float? Confidence,
    DateTimeOffset OccurredAt,
    bool HasClip,
    bool HasSnapshot,
    IReadOnlyList<string> EnteredZones);