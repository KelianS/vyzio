using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

// Sonde des chemins connus du système de fichiers, sans dépendance à un outil externe
// (nvidia-smi, lsusb) — sur un hôte qui ne les expose pas (dev, CI), retombe naturellement sur
// CPU. Limité aux paliers déployables avec l'image Frigate déjà pinnée : Nvidia/AMD retombent
// volontairement sur CPU (ADR-34, Coral USB non détecté — seul le PCIe l'est).
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

        if (File.Exists(IntelGpuRenderNodePath) && IsIntelGpuVendor())
            return FrigateDetectorKind.Openvino;

        return FrigateDetectorKind.Cpu;
    }

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
