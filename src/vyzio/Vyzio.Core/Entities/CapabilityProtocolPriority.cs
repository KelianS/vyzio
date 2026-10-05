namespace Vyzio.Core.Entities;

// The one order a capability's protocols are tried in, the same for every camera (ADR-71 b).
public static class CapabilityProtocolPriority
{
    // A proprietary protocol drives its own hardware, where a generic one may answer reads without acting (ADR-71 b).
    private static readonly SupportedProtocol[] ProprietaryFirst =
        [SupportedProtocol.V380, SupportedProtocol.Dvrip, SupportedProtocol.TapoKlap, SupportedProtocol.Onvif];

    // The stream keeps its own order: the standard transport, then the proprietary one (ADR-61 b).
    private static readonly SupportedProtocol[] StreamOrder = [SupportedProtocol.Rtsp, SupportedProtocol.Dvrip];

    // The given protocols in the capability's priority order; one the order does not name comes last.
    public static IReadOnlyList<SupportedProtocol> Sort(CameraCapability capability, IEnumerable<SupportedProtocol> protocols)
    {
        var order = OrderOf(capability);
        return protocols
            .OrderBy(protocol => Array.IndexOf(order, protocol) is var rank and >= 0 ? rank : order.Length)
            .ToList();
    }

    private static SupportedProtocol[] OrderOf(CameraCapability capability) => capability switch
    {
        CameraCapability.Stream => StreamOrder,
        CameraCapability.Ptz or CameraCapability.HardwarePrivacy or CameraCapability.ImageSettings => ProprietaryFirst,
        _ => throw new ArgumentOutOfRangeException(nameof(capability), capability, null),
    };
}
