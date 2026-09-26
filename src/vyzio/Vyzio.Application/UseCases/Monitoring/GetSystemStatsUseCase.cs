using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Monitoring;

public sealed class GetSystemStatsUseCase(
    FrigateStatusReader frigate,
    ICameraRepository cameras,
    IFrigateDetectorPlanner detectorPlanner,
    IFrigateConfigApplier configApplier)
{
    public async Task<SystemStatsDto> ExecuteAsync(CancellationToken ct = default)
    {
        var detection = await ResolveDetectionConfigAsync(ct);
        var pendingChanges = configApplier.HasPendingChanges;
        var (status, stats) = await frigate.ReadAsync(ct);

        if (stats is null)
            return new SystemStatsDto(SnakeCaseEnum.ToSnakeCase(status), Storage: null, Cameras: [], detection, pendingChanges);

        StorageStatsDto? storage = null;
        if (stats.Storage is { } s)
            storage = new StorageStatsDto(s.TotalGb, s.UsedGb, s.FreeGb);

        var cameraFps = stats.Cameras
            .Select(c => new CameraFpsDto(c.Camera, c.Fps))
            .ToList();

        return new SystemStatsDto(SnakeCaseEnum.ToSnakeCase(status), storage, cameraFps, detection, pendingChanges);
    }

    private async Task<DetectionConfigDto> ResolveDetectionConfigAsync(CancellationToken ct)
    {
        var catalog = await cameras.GetAllAsync(ct);
        var activeCount = catalog.Count(c => c.IsEnabled && c.ValidationState == CameraValidationState.Validated);
        var plan = detectorPlanner.Plan(activeCount);
        return new DetectionConfigDto(SnakeCaseEnum.ToSnakeCase(plan.Kind), plan.Fps);
    }
}

public sealed record SystemStatsDto(
    string Status,
    StorageStatsDto? Storage,
    IReadOnlyList<CameraFpsDto> Cameras,
    DetectionConfigDto Detection,
    bool PendingChanges
);

public sealed record StorageStatsDto(double TotalGb, double UsedGb, double FreeGb);
public sealed record CameraFpsDto(string Camera, double Fps);
public sealed record DetectionConfigDto(string Hardware, int TargetFps);
