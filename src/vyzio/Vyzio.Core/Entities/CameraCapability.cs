namespace Vyzio.Core.Entities;

// Optional camera capability, independent of brand (ADR-22).
// Stream is the base video transport (RTSP or DVRIP) — included so it can be displayed
// alongside advanced capabilities in the UI and bound to a SupportedProtocol.
public enum CameraCapability
{
    Stream,
    Ptz,
    HardwarePrivacy,
}
