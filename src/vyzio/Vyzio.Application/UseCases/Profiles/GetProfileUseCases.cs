using Vyzio.Application.DTOs.Profiles;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Profiles;

public sealed class GetProfilesUseCase(IProfileRepository profiles)
{
    public async Task<IReadOnlyList<ProfileDto>> ExecuteAsync(CancellationToken ct = default)
    {
        var all = await profiles.GetAllAsync(ct);
        return all.Select(ProfileDto.From).ToList();
    }
}

public sealed class GetProfileByIdUseCase(IProfileRepository profiles)
{
    /// <returns>The profile DTO, or null if not found.</returns>
    public async Task<ProfileDto?> ExecuteAsync(string id, CancellationToken ct = default)
    {
        var profile = await profiles.GetByIdAsync(id, ct);
        return profile is null ? null : ProfileDto.From(profile);
    }
}
