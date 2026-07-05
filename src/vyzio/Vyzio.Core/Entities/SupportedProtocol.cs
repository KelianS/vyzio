namespace Vyzio.Core.Entities;

// Unified network protocol enum — the single reference for both CameraCapabilityBinding.Protocol
// and Camera.SupportedProtocols. Replaces CapabilityProtocol, which mixed protocol and strategy
// values (PtzParking, SoftwareOnly) that have no business being in a protocol enum.
public enum SupportedProtocol
{
    Onvif,
    V380,
    Dvrip,
    TapoKlap,
    Rtsp,
}
