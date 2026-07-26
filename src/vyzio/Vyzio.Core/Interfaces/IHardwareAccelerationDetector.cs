using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IHardwareAccelerationDetector
{
    // Which accelerator runs object detection.
    FrigateDetectorKind Detect();

    // Which accelerator decodes video. Resolved independently of Detect(): a host with both a Coral
    // and an Intel iGPU — the classic Frigate build — must keep GPU decoding even though inference
    // runs on the Coral.
    FrigateHwAccel DetectVideoAcceleration();

    // Exposed here (rather than read directly via Environment.ProcessorCount) so the CPU FPS
    // budget calculation stays deterministic and testable regardless of the executing machine.
    int CpuCoreCount { get; }
}
