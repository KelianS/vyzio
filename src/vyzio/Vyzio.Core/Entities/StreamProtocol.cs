namespace Vyzio.Core.Entities;

// Camera ingestion transport (ADR-19). Rtsp is the primary path; Dvrip is the go2rtc fallback
// for cameras without native RTSP (Xiongmai/XMEye firmware: ICSee, Annke, Sannce, Zosi...).
public enum StreamProtocol
{
    Rtsp,
    Dvrip,
}
