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
        ["onvif_unicast"] = new(60, SupportedProtocol.Onvif),
        ["onvif"] = new(55, SupportedProtocol.Onvif),
        ["rtsp_describe"] = new(50, SupportedProtocol.Rtsp),
        ["tapo_klap_probe"] = new(45, SupportedProtocol.TapoKlap),
        ["http_probe"] = new(40, null),
        ["port_scan"] = new(38, null),
        ["network_scan"] = new(30, SupportedProtocol.Rtsp),
        ["hostname_probe"] = new(20, null),
        ["mac_vendor_probe"] = new(10, null),
        ["http_service"] = new(0, null),
        // Weaker than every other signal (Stage 1 baseline: "host answers ping, nothing matched").
        ["network_host"] = new(-10, null),
    };

    public static Entry? Lookup(string discoverySource) => BySource.GetValueOrDefault(discoverySource);
}
