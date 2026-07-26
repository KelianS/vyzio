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

// Fps is the rate of frames pulled from the stream; DetectionFps is the rate of inferences run on
// them. Frigate runs one inference per motion region plus one per tracked object, so DetectionFps
// is normally a multiple of Fps — their ratio is what the motion tuning loop steers on (ADR-35).
public sealed record CameraFps(string Camera, double Fps, double DetectionFps);
