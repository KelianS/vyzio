namespace Vyzio.Core.Entities;

// Optional camera capability, independent of brand (ADR-22).
// Stream is the base video transport (RTSP or DVRIP) — included so it can be displayed
// alongside advanced capabilities in the UI and bound to a SupportedProtocol.
// ImageSettings (ADR-27) has no persisted value on the binding — the camera is the only
// source of truth, Vyzio reads/writes live.
public enum CameraCapability
{
    Stream,
    Ptz,
    HardwarePrivacy,
    ImageSettings,
}
