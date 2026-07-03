namespace Vyzio.Core.Entities;

// Optional camera capability, independent of brand (ADR-22). Stream transport (RTSP/DVRIP,
// ADR-19) is foundational and stays out of this model — only optional/advanced capabilities
// are represented here.
public enum CameraCapability
{
    Ptz,
    PrivacyMode,
    // SystemInfo (futur)
}
