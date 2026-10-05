using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.Services;

// How a camera stream is named, sourced and read back inside go2rtc, which carries every camera (ADR-72 a).
public static class Go2rtcStreams
{
    // A stream is named by its rank, stable and unique per camera; the first rank takes the plain camera name.
    public static string Name(string frigateKey, CameraStream? stream)
        => stream is null or { Ordinal: 0 } ? frigateKey : $"{frigateKey}_{stream.Ordinal}";

    // Frigate reads video only: it records no sound, and an audio track would only cost bandwidth.
    public static string Restream(string name) => $"rtsp://127.0.0.1:8554/{name}?video";

    private static SupportedProtocol ProtocolOf(Camera camera, CameraStream? stream)
        => stream?.Protocol ?? camera.StreamBinding!.Protocol;

    // Percent-encoded, as go2rtc parses a URL, unlike Frigate's own input path (#91).
    public static string Source(Camera camera, CameraStream? stream)
    {
        var protocol = ProtocolOf(camera, stream);
        var scheme = protocol == SupportedProtocol.Dvrip ? "dvrip" : "rtsp";
        var account = camera.CredentialsFor(protocol);
        var userInfo = string.IsNullOrWhiteSpace(account.Username) ? string.Empty
            : string.IsNullOrEmpty(account.Password) ? $"{Uri.EscapeDataString(account.Username)}@"
            : $"{Uri.EscapeDataString(account.Username)}:{Uri.EscapeDataString(account.Password)}@";

        // An IPv6 literal is bracketed, as in any URL authority.
        var host = camera.Host.Contains(':', StringComparison.Ordinal) ? $"[{camera.Host}]" : camera.Host;
        return $"{scheme}://{userInfo}{host}:{camera.PortOf(protocol)}{PathAndQuery(protocol, stream?.Path)}";
    }

    // The DVRIP sub-stream is selected by query, not by path (`?channel=0&subtype=1`).
    private static string PathAndQuery(SupportedProtocol protocol, string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return "/";
        if (protocol == SupportedProtocol.Dvrip) return $"/?{path.TrimStart('/', '?')}";
        return $"/{path.TrimStart('/')}";
    }
}
