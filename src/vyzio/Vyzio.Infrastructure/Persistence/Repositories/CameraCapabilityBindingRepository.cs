using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Persistence.Repositories;

public sealed class CameraCapabilityBindingRepository(VyzioDbContext db) : ICameraCapabilityBindingRepository
{
    public Task<CameraCapabilityBinding?> GetAsync(string cameraId, CameraCapability capability, CancellationToken ct = default)
        => db.CameraCapabilityBindings
            .FirstOrDefaultAsync(b => b.CameraId == cameraId && b.Capability == capability, ct);

    public async Task<IReadOnlyList<CameraCapabilityBinding>> GetByCameraAsync(string cameraId, CancellationToken ct = default)
        => await db.CameraCapabilityBindings
            .Where(b => b.CameraId == cameraId)
            .ToListAsync(ct);

    public async Task SaveAsync(CameraCapabilityBinding binding, CancellationToken ct = default)
    {
        binding.UpdatedAt = DateTimeOffset.UtcNow;
        var existing = await db.CameraCapabilityBindings
            .FirstOrDefaultAsync(b => b.CameraId == binding.CameraId && b.Capability == binding.Capability, ct);

        if (existing is null)
        {
            db.CameraCapabilityBindings.Add(binding);
        }
        else
        {
            existing.Protocol = binding.Protocol;
            existing.ConfigJson = binding.ConfigJson;
            existing.Verified = binding.Verified;
            existing.VerifiedAt = binding.VerifiedAt;
            existing.LastError = binding.LastError;
            existing.UpdatedAt = binding.UpdatedAt;
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(string cameraId, CameraCapability capability, CancellationToken ct = default)
    {
        var existing = await db.CameraCapabilityBindings
            .FirstOrDefaultAsync(b => b.CameraId == cameraId && b.Capability == capability, ct);

        if (existing is null) return;

        db.CameraCapabilityBindings.Remove(existing);
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<CameraCapabilityBinding>> GetAllVerifiedAsync(CancellationToken ct = default)
        => await db.CameraCapabilityBindings
            .Where(b => b.Verified)
            .ToListAsync(ct);
}
