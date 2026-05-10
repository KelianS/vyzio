using Vyzio.Application.DTOs.Profiles;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Profiles;

public sealed class UpdateProfileUseCase(IProfileRepository profiles)
{
    /// <returns>Updated DTO, or null if not found.</returns>
    public async Task<ProfileDto?> ExecuteAsync(string id, UpdateProfileRequest request, CancellationToken ct = default)
    {
        var profile = await profiles.GetByIdAsync(id, ct);
        if (profile is null) return null;

        profile.Name = request.Name;
        profile.Category = request.Category;
        profile.AlertMode = request.AlertMode;

        await profiles.UpdateAsync(profile, ct);
        return ProfileDto.From(profile);
    }
}

public sealed class DeleteProfileUseCase(IProfileRepository profiles)
{
    /// <returns>True if deleted, false if not found.</returns>
    public async Task<bool> ExecuteAsync(string id, CancellationToken ct = default)
    {
        var profile = await profiles.GetByIdAsync(id, ct);
        if (profile is null) return false;

        await profiles.DeleteAsync(id, ct);
        return true;
    }
}
