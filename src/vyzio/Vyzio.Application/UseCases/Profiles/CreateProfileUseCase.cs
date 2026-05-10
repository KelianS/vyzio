using Vyzio.Application.DTOs.Profiles;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Profiles;

public sealed class CreateProfileUseCase(IProfileRepository profiles)
{
    public async Task<ProfileDto> ExecuteAsync(CreateProfileRequest request, CancellationToken ct = default)
    {
        var profile = new Profile
        {
            Name = request.Name,
            Category = request.Category,
            AlertMode = request.AlertMode
        };

        await profiles.AddAsync(profile, ct);
        return ProfileDto.From(profile);
    }
}
