using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Persistence.Repositories;

internal sealed class PtzPresetRepository(VyzioDbContext db) : IPtzPresetRepository
{
    public async Task<IReadOnlyList<PtzPreset>> GetAllAsync(string cameraId, CancellationToken ct = default)
        => await db.PtzPresets.Where(p => p.CameraId == cameraId).OrderBy(p => p.PresetId).ToListAsync(ct);

    public async Task<PtzPreset?> GetAsync(string cameraId, int presetId, CancellationToken ct = default)
        => await db.PtzPresets.FirstOrDefaultAsync(p => p.CameraId == cameraId && p.PresetId == presetId, ct);

    public async Task UpsertAsync(PtzPreset preset, CancellationToken ct = default)
    {
        var existing = await db.PtzPresets
            .FirstOrDefaultAsync(p => p.CameraId == preset.CameraId && p.PresetId == preset.PresetId, ct);

        if (existing is null)
        {
            db.PtzPresets.Add(preset);
        }
        else
        {
            existing.Label = preset.Label;
            existing.Native = preset.Native;
            existing.NativeToken = preset.NativeToken;
            existing.StepsX = preset.StepsX;
            existing.StepsY = preset.StepsY;
        }

        await db.SaveChangesAsync(ct);
    }
}
