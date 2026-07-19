using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.Services.CameraDiscovery;

// ADR-32 — THE single list of ports the "nmap" stage sweeps, plus which protocol fingerprint(s)
// to attempt on each. Two independent facets, both extensible in one place:
//   • ScannedPorts: every port we TCP-connect, with the conventional service name shown when no
//     protocol fingerprint confirms — so an open port always surfaces, even unidentified.
//   • Fingerprints: protocol → the ports where it may live + its display label. A port maps to an
//     open-port fact; only a passing fingerprint turns it into a confirmed protocol (this is what
//     stops "8800 open" from being blindly labelled V380 on a camera that isn't one).
// Adding a protocol with a dedicated port = one ScannedPorts entry + one Fingerprints entry; the
// table, capability cross-reference and qualification all follow automatically.
internal static class DiscoveryPortCatalog
{
    // Conventional service label shown for an open port with no confirmed protocol. Empty string
    // for camera-protocol ports that aren't IANA-standard (8800/8899/2020/34567): there, an open
    // port with a failing fingerprint stays "unidentified" rather than gaining a misleading name.
    public static readonly IReadOnlyDictionary<int, string> ScannedPorts = new Dictionary<int, string>
    {
        [22] = "SSH",
        [23] = "Telnet",
        [80] = "HTTP",
        [443] = "HTTPS",
        [554] = "RTSP",
        [2020] = "",
        [8000] = "HTTP",
        [8080] = "HTTP",
        [8081] = "HTTP",
        [8443] = "HTTPS",
        [8554] = "RTSP",
        [8800] = "",
        [8899] = "",
        [34567] = "",
        [37777] = "Dahua",
    };

    internal sealed record Fingerprint(SupportedProtocol Protocol, string Label, IReadOnlyList<int> Ports);

    public static readonly IReadOnlyList<Fingerprint> Fingerprints =
    [
        new(SupportedProtocol.Rtsp, "RTSP", [554, 8554]),
        // ONVIF has no single standard port — commonly 80, 2020, 8000, 8080, or 8899 (V380/XM).
        new(SupportedProtocol.Onvif, "ONVIF", [80, 2020, 8000, 8080, 8899]),
        new(SupportedProtocol.V380, "V380", [8800]),
        new(SupportedProtocol.Dvrip, "DVRIP", [34567]),
        new(SupportedProtocol.TapoKlap, "Tapo KLAP", [80, 443]),
    ];

    public static IReadOnlyList<int> Ports { get; } = ScannedPorts.Keys.Order().ToArray();

    // Ports where a deeper follow-up probe adds value beyond "port open": RTSP DESCRIBE (to get the
    // real stream path) and the HTTP vendor fingerprint (title/Server header → brand hint).
    public static IReadOnlyList<int> RtspProbePorts { get; } =
        Fingerprints.First(f => f.Protocol == SupportedProtocol.Rtsp).Ports;

    public static IReadOnlyList<int> HttpProbePorts { get; } =
        ScannedPorts.Where(p => p.Value is "HTTP" or "HTTPS").Select(p => p.Key).Order().ToArray();

    // Common RTSP stream paths tried by RTSP DESCRIBE, in priority order (ICSee/XMEye variants last).
    public static IReadOnlyList<string> RtspPaths { get; } =
    [
        "/stream1", "/stream2",
        "/Streaming/Channels/101",
        "/live/ch00_1",
        "/h264Preview_01_main",
        "/user=admin&password=&channel=1&stream=0.sdp",
        "/user=admin&password=&channel=1&stream=1.sdp",
        "/cam/realmonitor?channel=1&subtype=0",
    ];

    public static IReadOnlyList<Fingerprint> FingerprintsForPort(int port)
        => Fingerprints.Where(f => f.Ports.Contains(port)).ToArray();

    public static string ServiceLabel(int port) => ScannedPorts.GetValueOrDefault(port, string.Empty);

    public static string FormatProtocolLabel(SupportedProtocol protocol)
        => Fingerprints.FirstOrDefault(f => f.Protocol == protocol)?.Label ?? protocol.ToString();
}
