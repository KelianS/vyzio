using Vyzio.Application.DTOs.Cameras;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

// A5: includes verified capability bindings in the list response to avoid a second API call
// at hub load — the PTZ panel and capability badges can be shown immediately.
public sealed class GetCamerasUseCase(ICameraRepository cameras, ICameraCapabilityBindingRepository bindings)
{
    public async Task<IReadOnlyList<CameraDto>> ExecuteAsync(CancellationToken ct = default)
    {
        var all = await cameras.GetAllAsync(ct);
        var verified = await bindings.GetAllVerifiedAsync(ct);
        return all.Select(c => CameraDto.From(c, verified)).ToList();
    }
}

public sealed class GetCameraStatusUseCase(ICameraRepository cameras)
{
    public async Task<CameraStatusDto?> ExecuteAsync(string id, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(id, ct);
        return camera is null ? null : CameraStatusDto.From(camera);
    }
}