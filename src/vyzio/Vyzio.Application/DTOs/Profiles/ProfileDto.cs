using Vyzio.Core.Entities;

namespace Vyzio.Application.DTOs.Profiles;

public sealed record ProfileDto(
    string Id,
    string Name,
    string Category,
    string AlertMode,
    int EmbeddingCount,
    DateTimeOffset? LastSeenAt,
    DateTimeOffset CreatedAt)
{
    public static ProfileDto From(Profile p) => new(
        p.Id,
        p.Name,
        p.Category,
        p.AlertMode,
        p.EmbeddingCount,
        p.LastSeenAt,
        p.CreatedAt);
}
