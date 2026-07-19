using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.Services.CameraDiscovery;

// ADR-32 — maps a discoverySource to its merge priority (AssistedCameraDiscoveryFormatter) and,
// for handshake probes that identify a real capability protocol, to that SupportedProtocol
// (AssistedCameraDiscoveryService, to cross-reference the capability registry). The port sweep's
// own protocol identity comes from DiscoveryPortCatalog (per open port), not from here — this
// catalog only covers the non-sweep sources plus the sweep's merge priority.
internal static class DiscoveryProtocolCatalog
{
    // CapabilityProtocol is set only when the source, on its own, proves a capability protocol
    // (ONVIF/KLAP handshake, RTSP DESCRIBE). null for generic/aggregate sources (port_scan, http,
    // hostname, mac, network_host) — for port_scan the protocol is resolved per port instead.
    internal sealed record Entry(int Priority, SupportedProtocol? CapabilityProtocol);

    private static readonly IReadOnlyDictionary<string, Entry> BySource = new Dictionary<string, Entry>
    {
        ["onvif"] = new(55, SupportedProtocol.Onvif),        // ONVIF multicast announcement
        ["rtsp_describe"] = new(50, SupportedProtocol.Rtsp), // RTSP DESCRIBE (found a stream path)
        ["http_probe"] = new(40, null),                      // HTTP vendor hint
        ["port_scan"] = new(38, null),                       // open port (protocol via ConfirmedProtocol)
        ["hostname_probe"] = new(20, null),
        ["mac_vendor_probe"] = new(10, null),
        ["http_service"] = new(0, null),
        // Weaker than every other signal (Stage 1 baseline: "host answers ping, nothing matched").
        ["network_host"] = new(-10, null),
    };

    public static Entry? Lookup(string discoverySource) => BySource.GetValueOrDefault(discoverySource);
}
