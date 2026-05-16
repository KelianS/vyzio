using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IProfileCameraLinkRepository
{
    Task<IReadOnlyList<ProfileCameraLink>> GetByCameraIdAsync(string cameraId, CancellationToken ct = default);
    Task<IReadOnlyList<ProfileCameraLink>> GetByProfileIdAsync(string profileId, CancellationToken ct = default);
    Task<ProfileCameraLink?> GetByProfileAndCameraAsync(string profileId, string cameraId, CancellationToken ct = default);
    Task UpsertAsync(ProfileCameraLink link, CancellationToken ct = default);
    Task DeleteByProfileAndCameraAsync(string profileId, string cameraId, CancellationToken ct = default);
}
