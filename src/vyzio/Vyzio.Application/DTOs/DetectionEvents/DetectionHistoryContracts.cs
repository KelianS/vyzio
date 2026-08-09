namespace Vyzio.Application.DTOs.DetectionEvents;

/// <summary>
/// A slice of the history. <paramref name="NextCursor"/> is null once the last detection is reached;
/// Frigate paginates by time, not by page number (ADR-49).
/// </summary>
public sealed record DetectionHistoryPageDto(
    IReadOnlyList<DetectionEventContract> Items,
    string? NextCursor);

public sealed record CorrectDetectionIdentityRequest(string? ProfileId);
