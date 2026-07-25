using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Configuration;

namespace Vyzio.Infrastructure.Services;

// Single place that turns hardware detection into a (detector kind, target FPS) decision (ADR-34) —
// FrigateConfigApplier and GetSystemStatsUseCase both consume this instead of recomputing it.
public sealed class FrigateDetectorPlanner(VyzioRuntimeSettings settings, IHardwareAccelerationDetector hardwareDetector) : IFrigateDetectorPlanner
{
    public FrigateDetectorPlan Plan(int activeCameraCount)
    {
        var kind = hardwareDetector.Detect();
        return new FrigateDetectorPlan(kind, ComputeFps(kind, activeCameraCount));
    }

    private int ComputeFps(FrigateDetectorKind kind, int activeCameraCount)
    {
        if (kind != FrigateDetectorKind.Cpu)
            return 5;

        var fpsMin = settings.Frigate.CpuDetectFpsMin;
        var fpsMax = settings.Frigate.CpuDetectFpsMax;
        var cameraCount = Math.Max(1, activeCameraCount);
        var totalFpsBudget = hardwareDetector.CpuCoreCount * settings.Frigate.CpuDetectFpsPerCore;
        return Math.Clamp((int)Math.Floor(totalFpsBudget / cameraCount), fpsMin, fpsMax);
    }
}
