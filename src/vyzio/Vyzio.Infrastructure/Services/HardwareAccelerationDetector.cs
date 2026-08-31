using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

// Probes known device paths instead of shelling out to nvidia-smi or lsusb, and only for the tiers the pinned Frigate image can actually use (ADR-34).
public sealed class HardwareAccelerationDetector : IHardwareAccelerationDetector
{
    private const string CoralPciePath = "/dev/apex_0";
    private const string IntelGpuRenderNodePath = "/dev/dri/renderD128";
    private const string IntelGpuVendorPath = "/sys/class/drm/renderD128/device/vendor";
    private const string IntelPciVendorId = "0x8086";

    public FrigateDetectorKind Detect()
    {
        if (File.Exists(CoralPciePath))
            return FrigateDetectorKind.EdgeTpu;

        if (HasIntelGpu())
            return FrigateDetectorKind.Openvino;

        return FrigateDetectorKind.Cpu;
    }

    // Not derived from Detect(): a Coral takes precedence for inference, but an Intel iGPU on the
    // same host must still handle decoding.
    public FrigateHwAccel DetectVideoAcceleration() =>
        HasIntelGpu() ? FrigateHwAccel.Vaapi : FrigateHwAccel.None;

    public int CpuCoreCount => Environment.ProcessorCount;

    private static bool HasIntelGpu() => File.Exists(IntelGpuRenderNodePath) && IsIntelGpuVendor();

    private static bool IsIntelGpuVendor()
    {
        try
        {
            return File.ReadAllText(IntelGpuVendorPath).Trim().Equals(IntelPciVendorId, StringComparison.OrdinalIgnoreCase);
        }
        catch (IOException)
        {
            return false;
        }
        catch (UnauthorizedAccessException)
        {
            return false;
        }
    }
}
