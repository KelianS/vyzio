using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.Services.CameraDiscovery;

// ADR-32 — THE single source of truth for the port sweep ("nmap" stage): which TCP ports to try,
// and what an open port means. Adding a protocol that has its own dedicated port is one line here
// — the sweep tries it, the enrichment table shows it, the capability interpretation cross-refs it
// (via CapabilityProtocol), and qualification treats it as a camera signal. No frontend change and
// no other backend change are needed.
//
// Protocols that share port 80 (ONVIF-on-80, Tapo KLAP) can't be told apart by an open port alone
// — an open 80 just means "a web server". Those keep a dedicated handshake probe; here 80/443/8080
// only ever mean generic HTTP (CameraSignal = false: an open web port is not, by itself, a camera).
internal static class DiscoveryPortCatalog
{
    // Protocol is the SupportedProtocol enum when the open port maps to a real capability protocol
    // (used to cross-reference the capability registry), null for generic web ports.
    internal sealed record PortDefinition(int Port, SupportedProtocol? Protocol, string Label, bool CameraSignal);

    public static readonly IReadOnlyList<PortDefinition> All =
    [
        new(554,   SupportedProtocol.Rtsp,  "RTSP",  CameraSignal: true),
        new(2020,  SupportedProtocol.Onvif, "ONVIF", CameraSignal: true),
        new(8800,  SupportedProtocol.V380,  "V380",  CameraSignal: true),
        new(34567, SupportedProtocol.Dvrip, "DVRIP", CameraSignal: true),
        new(80,    null,                    "HTTP",  CameraSignal: false),
        new(443,   null,                    "HTTPS", CameraSignal: false),
        new(8080,  null,                    "HTTP",  CameraSignal: false),
    ];

    public static IReadOnlyList<int> Ports { get; } = All.Select(p => p.Port).Distinct().Order().ToArray();

    public static PortDefinition? Lookup(int port) => All.FirstOrDefault(p => p.Port == port);
}
