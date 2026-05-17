namespace Vyzio.Core.Interfaces;

public interface IFrigateStatsProvider
{
    Task<FrigateStats?> TryGetStatsAsync(CancellationToken ct = default);
}

public sealed record FrigateStats(
    StorageStats? Storage,
    IReadOnlyList<CameraFps> Cameras
);

public sealed record StorageStats(double TotalGb, double UsedGb, double FreeGb);

public sealed record CameraFps(string Camera, double Fps);
