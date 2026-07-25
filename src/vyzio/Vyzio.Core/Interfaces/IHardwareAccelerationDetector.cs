using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IHardwareAccelerationDetector
{
    FrigateDetectorKind Detect();

    // Exposed here (rather than read directly via Environment.ProcessorCount) so the CPU FPS
    // budget calculation stays deterministic and testable regardless of the executing machine.
    int CpuCoreCount { get; }
}
