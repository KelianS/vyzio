namespace Vyzio.Core.Entities;

// Camera capability, independent of brand (ADR-04). Stream is the video stream, bound like the others
// to the protocol that carries it, RTSP or DVRIP (ADR-04).
// ImageSettings (ADR-11) has no persisted value on the binding — the camera is the only
// source of truth, Vyzio reads/writes live.
public enum CameraCapability
{
    Stream,
    Ptz,
    HardwarePrivacy,
    ImageSettings,
}
