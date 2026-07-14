using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IPtzPresetRepository
{
    Task<IReadOnlyList<PtzPreset>> GetAllAsync(string cameraId, CancellationToken ct = default);
    Task<PtzPreset?> GetAsync(string cameraId, int presetId, CancellationToken ct = default);
    Task UpsertAsync(PtzPreset preset, CancellationToken ct = default);
}
