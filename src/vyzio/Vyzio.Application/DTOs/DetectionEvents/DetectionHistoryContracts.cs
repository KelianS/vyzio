namespace Vyzio.Application.DTOs.DetectionEvents;

public sealed record PagedDetectionHistoryDto(
    IReadOnlyList<DetectionEventContract> Items,
    int Total,
    int Page,
    int Limit,
    int TotalPages);

public sealed record CorrectDetectionIdentityRequest(string? ProfileId);
