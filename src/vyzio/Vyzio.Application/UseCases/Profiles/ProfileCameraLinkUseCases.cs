using Vyzio.Application.DTOs.Profiles;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Profiles;

public sealed class GetCameraProfileLinksUseCase(
    IProfileCameraLinkRepository links,
    IProfileRepository profiles)
{
    public async Task<IReadOnlyList<ProfileCameraLinkDto>> ExecuteAsync(string cameraId, CancellationToken ct = default)
    {
        var cameraLinks = await links.GetByCameraIdAsync(cameraId, ct);
        var profileIds = cameraLinks.Select(l => l.ProfileId).Distinct().ToList();
        var profilesById = (await profiles.GetAllAsync(ct))
            .Where(p => profileIds.Contains(p.Id))
            .ToDictionary(p => p.Id);

        return cameraLinks.Select(l => new ProfileCameraLinkDto(
            l.Id,
            l.ProfileId,
            profilesById.TryGetValue(l.ProfileId, out var p) ? p.Name : l.ProfileId,
            l.CameraId,
            null,
            l.Enabled)).ToList();
    }
}

public sealed class GetProfileCameraLinksUseCase(
    IProfileCameraLinkRepository links,
    ICameraRepository cameras)
{
    public async Task<IReadOnlyList<ProfileCameraLinkDto>> ExecuteAsync(string profileId, CancellationToken ct = default)
    {
        var profileLinks = await links.GetByProfileIdAsync(profileId, ct);
        var cameraIds = profileLinks.Select(l => l.CameraId).Distinct().ToList();
        var camerasById = (await cameras.GetAllAsync(ct))
            .Where(c => cameraIds.Contains(c.Id))
            .ToDictionary(c => c.Id);

        return profileLinks.Select(l => new ProfileCameraLinkDto(
            l.Id,
            l.ProfileId,
            string.Empty,
            l.CameraId,
            camerasById.TryGetValue(l.CameraId, out var c) ? c.DisplayName : l.CameraId,
            l.Enabled)).ToList();
    }
}

public sealed class SetCameraProfileLinksUseCase(
    IProfileCameraLinkRepository links,
    IProfileRepository profiles)
{
    // Full replacement: sets exactly the provided profiles as linked (enabled) for the camera.
    // Profiles not in the list are removed.
    public async Task<IReadOnlyList<ProfileCameraLinkDto>> ExecuteAsync(
        string cameraId,
        SetCameraProfileLinksRequest request,
        CancellationToken ct = default)
    {
        var existingLinks = await links.GetByCameraIdAsync(cameraId, ct);
        var requestedProfileIds = request.ProfileIds.ToHashSet(StringComparer.Ordinal);

        // Remove links no longer requested
        foreach (var link in existingLinks.Where(l => !requestedProfileIds.Contains(l.ProfileId)))
        {
            await links.DeleteByProfileAndCameraAsync(link.ProfileId, cameraId, ct);
        }

        // Upsert links for requested profiles (validate they exist)
        var validProfiles = (await profiles.GetAllAsync(ct))
            .Where(p => requestedProfileIds.Contains(p.Id))
            .ToList();

        foreach (var profile in validProfiles)
        {
            await links.UpsertAsync(new ProfileCameraLink
            {
                ProfileId = profile.Id,
                CameraId = cameraId,
                Enabled = true,
            }, ct);
        }

        var updatedLinks = await links.GetByCameraIdAsync(cameraId, ct);
        var profilesById = validProfiles.ToDictionary(p => p.Id);

        return updatedLinks.Select(l => new ProfileCameraLinkDto(
            l.Id,
            l.ProfileId,
            profilesById.TryGetValue(l.ProfileId, out var p) ? p.Name : l.ProfileId,
            l.CameraId,
            null,
            l.Enabled)).ToList();
    }
}

public sealed class SetProfileCameraLinksUseCase(
    IProfileCameraLinkRepository links,
    ICameraRepository cameras,
    IProfileRepository profiles)
{
    // Full replacement: sets exactly the provided cameras as linked (enabled) for the profile.
    public async Task<IReadOnlyList<ProfileCameraLinkDto>> ExecuteAsync(
        string profileId,
        SetProfileCameraLinksRequest request,
        CancellationToken ct = default)
    {
        var profile = await profiles.GetByIdAsync(profileId, ct);
        if (profile is null)
            return [];

        var existingLinks = await links.GetByProfileIdAsync(profileId, ct);
        var requestedCameraIds = request.CameraIds.ToHashSet(StringComparer.Ordinal);

        foreach (var link in existingLinks.Where(l => !requestedCameraIds.Contains(l.CameraId)))
        {
            await links.DeleteByProfileAndCameraAsync(profileId, link.CameraId, ct);
        }

        var validCameras = (await cameras.GetAllAsync(ct))
            .Where(c => requestedCameraIds.Contains(c.Id))
            .ToList();

        foreach (var camera in validCameras)
        {
            await links.UpsertAsync(new ProfileCameraLink
            {
                ProfileId = profileId,
                CameraId = camera.Id,
                Enabled = true,
            }, ct);
        }

        var updatedLinks = await links.GetByProfileIdAsync(profileId, ct);
        var camerasById = validCameras.ToDictionary(c => c.Id);

        return updatedLinks.Select(l => new ProfileCameraLinkDto(
            l.Id,
            l.ProfileId,
            profile.Name,
            l.CameraId,
            camerasById.TryGetValue(l.CameraId, out var c) ? c.DisplayName : l.CameraId,
            l.Enabled)).ToList();
    }
}
