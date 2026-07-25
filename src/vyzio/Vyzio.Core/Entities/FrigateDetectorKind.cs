namespace Vyzio.Core.Entities;

// Hardware tier used to build Frigate's `detectors` section (ADR-34). Only tiers deployable
// against the currently-pinned Frigate image (Coral PCIe, Intel GPU, CPU) — Nvidia/AMD would
// require a different Frigate image variant, out of scope for now.
public enum FrigateDetectorKind
{
    EdgeTpu,
    Openvino,
    Cpu,
}
