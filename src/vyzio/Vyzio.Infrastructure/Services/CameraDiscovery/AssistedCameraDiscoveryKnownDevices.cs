using System.Text.RegularExpressions;
using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.Services.CameraDiscovery;

internal static class AssistedCameraDiscoveryKnownDevices
{
    // The vendor comes only from a protocol no other firmware speaks; a port, hostname or web page never sets it (ADR-71).
    public static VendorFamily? VendorProvenBy(SupportedProtocol? confirmedProtocol) => confirmedProtocol switch
    {
        SupportedProtocol.V380 => VendorFamily.V380Pro,
        _ => null,
    };

    // A name hint for the display and the "probably a camera" ranking, never for the vendor (ADR-71).
    public static bool LooksLikeCameraHostName(string hostName)
    {
        var normalized = hostName.ToLowerInvariant();
        return normalized.Contains("camera")
            || normalized.Contains("ipcam")
            || normalized.Contains("webcam")
            || normalized.Contains("v380")
            || normalized.Contains("tapo")
            || normalized.Contains("icsee")
            || normalized.Contains("xmeye")
            || Regex.IsMatch(normalized, @"\bc\d{2,3}\b")
            || Regex.IsMatch(normalized, @"^mv\d");
    }
}
