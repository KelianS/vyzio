namespace Vyzio.Core.Entities;

public sealed record DetectionHistoryQuery(
    string? Camera = null,
    string? Label = null,
    string? ProfileId = null,
    DateTimeOffset? From = null,
    DateTimeOffset? To = null,
    int Page = 1,
    int Limit = 20);
