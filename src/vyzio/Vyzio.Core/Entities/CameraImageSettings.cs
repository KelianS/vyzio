namespace Vyzio.Core.Entities;

// Night vision (IR-cut) mode — ONVIF ver10/schema IrCutFilterMode, exposed as three states
// a non-technical user can understand (SPECS §10).
public enum IrCutMode
{
    Auto,
    On,
    Off,
}

// Live snapshot of a camera's image settings (ADR-27). Never persisted on the Vyzio side —
// the camera is the sole source of truth; Vyzio reads/writes it directly on every call.
public sealed record CameraImageSettings(
    int Brightness,
    int Contrast,
    int Saturation,
    int Sharpness,
    IrCutMode IrCutMode);
