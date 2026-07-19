using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Monitoring;

public sealed class GetSystemStatsUseCase(IFrigateStatsProvider statsProvider, IFrigateRestartTracker restartTracker)
{
    public async Task<SystemStatsDto> ExecuteAsync(CancellationToken ct = default)
    {
        var stats = await statsProvider.TryGetStatsAsync(ct);

        if (stats is null)
        {
            var status = restartTracker.IsRestarting ? FrigateStatus.Restarting : FrigateStatus.Unavailable;
            return new SystemStatsDto(SnakeCaseEnum.ToSnakeCase(status), Storage: null, Cameras: []);
        }

        restartTracker.MarkRestartComplete();

        StorageStatsDto? storage = null;
        if (stats.Storage is { } s)
            storage = new StorageStatsDto(s.TotalGb, s.UsedGb, s.FreeGb);

        var cameras = stats.Cameras
            .Select(c => new CameraFpsDto(c.Camera, c.Fps))
            .ToList();

        return new SystemStatsDto(SnakeCaseEnum.ToSnakeCase(FrigateStatus.Active), storage, cameras);
    }
}

public sealed record SystemStatsDto(
    string Status,
    StorageStatsDto? Storage,
    IReadOnlyList<CameraFpsDto> Cameras
);

public sealed record StorageStatsDto(double TotalGb, double UsedGb, double FreeGb);
public sealed record CameraFpsDto(string Camera, double Fps);
