using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Monitoring;

public sealed class GetSystemStatsUseCase(IFrigateStatsProvider statsProvider)
{
    public async Task<SystemStatsDto> ExecuteAsync(CancellationToken ct = default)
    {
        var stats = await statsProvider.TryGetStatsAsync(ct);

        if (stats is null)
            return new SystemStatsDto(Available: false, Storage: null, Cameras: []);

        StorageStatsDto? storage = null;
        if (stats.Storage is { } s)
            storage = new StorageStatsDto(s.TotalGb, s.UsedGb, s.FreeGb);

        var cameras = stats.Cameras
            .Select(c => new CameraFpsDto(c.Camera, c.Fps))
            .ToList();

        return new SystemStatsDto(Available: true, Storage: storage, Cameras: cameras);
    }
}

public sealed record SystemStatsDto(
    bool Available,
    StorageStatsDto? Storage,
    IReadOnlyList<CameraFpsDto> Cameras
);

public sealed record StorageStatsDto(double TotalGb, double UsedGb, double FreeGb);
public sealed record CameraFpsDto(string Camera, double Fps);
