using Vyzio.Core.Common;
using Vyzio.Core.Entities;

namespace Vyzio.Application.DTOs.Profiles;

public sealed record ProfileDto(
    string Id,
    string Name,
    string Category,
    string AlertMode,
    DateTimeOffset? LastSeenAt,
    DateTimeOffset CreatedAt)
{
    public static ProfileDto From(Profile p) => new(
        p.Id,
        p.Name,
        p.Category,
        SnakeCaseEnum.ToSnakeCase(p.AlertMode),
        p.LastSeenAt,
        p.CreatedAt);
}
