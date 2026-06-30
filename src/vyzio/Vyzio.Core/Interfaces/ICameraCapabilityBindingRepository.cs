using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface ICameraCapabilityBindingRepository
{
    Task<CameraCapabilityBinding?> GetAsync(string cameraId, CameraCapability capability, CancellationToken ct = default);

    Task<IReadOnlyList<CameraCapabilityBinding>> GetByCameraAsync(string cameraId, CancellationToken ct = default);

    Task SaveAsync(CameraCapabilityBinding binding, CancellationToken ct = default);

    Task DeleteAsync(string cameraId, CameraCapability capability, CancellationToken ct = default);
}
