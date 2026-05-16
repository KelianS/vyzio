using Microsoft.Extensions.Logging;
using Vyzio.Application.DTOs.Profiles;
using Vyzio.Application.Options;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Profiles;

public sealed class GetProfilePhotosUseCase(IProfilePhotoRepository photos)
{
    public async Task<IReadOnlyList<ProfilePhotoDto>> ExecuteAsync(string profileId, CancellationToken ct = default)
    {
        var list = await photos.GetByProfileIdAsync(profileId, ct);
        return list.Select(ProfilePhotoDto.From).ToList();
    }
}

public sealed class AddProfilePhotoUseCase(
    IProfileRepository profiles,
    IProfilePhotoRepository photos,
    IFrigateFaceLibrary faceLibrary,
    FaceStorageOptions storage,
    ILogger<AddProfilePhotoUseCase> logger)
{
    public async Task<ProfilePhotoDto> ExecuteAsync(
        string profileId,
        string originalFilename,
        byte[] imageBytes,
        CancellationToken ct = default)
    {
        var profile = await profiles.GetByIdAsync(profileId, ct)
            ?? throw new KeyNotFoundException($"Profile {profileId} not found.");

        if (imageBytes.Length == 0)
            throw new ArgumentException("Image data cannot be empty.");

        var ext = Path.GetExtension(originalFilename).ToLowerInvariant() is ".jpg" or ".jpeg" ? ".jpg" : ".jpg";
        var filename = $"{Guid.NewGuid():N}{ext}";

        var facesDir = Path.Combine(storage.DataDirectory, "faces", profileId);
        Directory.CreateDirectory(facesDir);
        await File.WriteAllBytesAsync(Path.Combine(facesDir, filename), imageBytes, ct);

        var photo = new ProfilePhoto
        {
            ProfileId = profileId,
            Filename = filename,
        };
        await photos.AddAsync(photo, ct);

        try
        {
            await faceLibrary.UploadFacePhotoAsync(profile.Name, filename, imageBytes, ct);
            photo.FrigateSynced = true;
            photo.SyncedAt = DateTimeOffset.UtcNow;
            await photos.UpdateAsync(photo, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Failed to sync photo {Filename} for profile {ProfileId} to Frigate face library. Will remain unsynced.",
                filename, profileId);
        }

        return ProfilePhotoDto.From(photo);
    }
}

public sealed class RemoveProfilePhotoUseCase(
    IProfileRepository profiles,
    IProfilePhotoRepository photos,
    IFrigateFaceLibrary faceLibrary,
    FaceStorageOptions storage,
    ILogger<RemoveProfilePhotoUseCase> logger)
{
    public async Task<bool> ExecuteAsync(string profileId, string photoId, CancellationToken ct = default)
    {
        var photo = await photos.GetByIdAsync(photoId, ct);
        if (photo is null || photo.ProfileId != profileId)
            return false;

        var profile = await profiles.GetByIdAsync(profileId, ct);

        var filePath = Path.Combine(storage.DataDirectory, "faces", profileId, photo.Filename);
        if (File.Exists(filePath))
            File.Delete(filePath);

        if (profile is not null && photo.FrigateSynced)
        {
            try
            {
                await faceLibrary.DeleteFacePhotoAsync(profile.Name, photo.Filename, ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex,
                    "Failed to remove photo {Filename} from Frigate face library for profile {ProfileId}.",
                    photo.Filename, profileId);
            }
        }

        await photos.DeleteAsync(photoId, ct);
        return true;
    }
}

public sealed class ResyncFaceLibraryUseCase(
    IProfileRepository profiles,
    IProfilePhotoRepository photos,
    IFrigateFaceLibrary faceLibrary,
    FaceStorageOptions storage,
    ILogger<ResyncFaceLibraryUseCase> logger)
{
    public async Task<int> ExecuteAsync(CancellationToken ct = default)
    {
        var unsynced = await photos.GetUnsyncedAsync(ct);
        var profilesById = (await profiles.GetAllAsync(ct)).ToDictionary(p => p.Id);
        var synced = 0;

        foreach (var photo in unsynced)
        {
            if (!profilesById.TryGetValue(photo.ProfileId, out var profile))
                continue;

            try
            {
                var filePath = Path.Combine(storage.DataDirectory, "faces", photo.ProfileId, photo.Filename);
                if (!File.Exists(filePath))
                    continue;

                var bytes = await File.ReadAllBytesAsync(filePath, ct);
                await faceLibrary.UploadFacePhotoAsync(profile.Name, photo.Filename, bytes, ct);
                photo.FrigateSynced = true;
                photo.SyncedAt = DateTimeOffset.UtcNow;
                await photos.UpdateAsync(photo, ct);
                synced++;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to resync photo {PhotoId} for profile {ProfileId}.", photo.Id, photo.ProfileId);
            }
        }

        return synced;
    }
}
