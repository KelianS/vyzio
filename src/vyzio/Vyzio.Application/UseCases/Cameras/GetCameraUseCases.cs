using Vyzio.Application.DTOs.Cameras;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

public sealed class GetCamerasUseCase(ICameraRepository cameras)
{
    public async Task<IReadOnlyList<CameraDto>> ExecuteAsync(CancellationToken ct = default)
    {
        var all = await cameras.GetAllAsync(ct);
        return all.Select(CameraDto.From).ToList();
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