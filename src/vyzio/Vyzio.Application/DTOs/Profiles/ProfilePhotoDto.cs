using Vyzio.Core.Entities;

namespace Vyzio.Application.DTOs.Profiles;

public sealed record ProfilePhotoDto(
    string Id,
    string ProfileId,
    string Filename,
    bool FrigateSynced,
    DateTimeOffset? SyncedAt,
    DateTimeOffset CreatedAt)
{
    public static ProfilePhotoDto From(ProfilePhoto p) => new(
        p.Id,
        p.ProfileId,
        p.Filename,
        p.FrigateSynced,
        p.SyncedAt,
        p.CreatedAt);
}
