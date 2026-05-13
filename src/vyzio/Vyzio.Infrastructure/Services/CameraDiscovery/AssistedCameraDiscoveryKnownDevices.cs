using System.Text.RegularExpressions;

namespace Vyzio.Infrastructure.Services.CameraDiscovery;

internal static class AssistedCameraDiscoveryKnownDevices
{
    public static string? DetectVendorFamily(string? displayName, string? note, string? hostName, string? macAddress)
    {
        var fingerprint = $"{displayName} {note} {hostName}".ToLowerInvariant();
        var oui = NormalizeOui(macAddress);

        if (fingerprint.Contains("tapo") || fingerprint.Contains("tp-link") || fingerprint.Contains("tplink"))
        {
            return "tplink_tapo";
        }

        if (oui is "5C:62:8B")
        {
            return "tplink_tapo";
        }

        return null;
    }

    public static string FormatVendorFamily(string vendorFamily) => vendorFamily switch
    {
        "tplink_tapo" => "TP-Link Tapo",
        _ => vendorFamily,
    };

    public static bool IsKnownMacVendor(string? macAddress)
        => !string.IsNullOrWhiteSpace(DetectVendorFamily(null, null, null, macAddress));

    public static bool LooksLikeCameraHostName(string hostName)
    {
        var normalized = hostName.ToLowerInvariant();
        return normalized.Contains("camera")
            || normalized.Contains("ipcam")
            || normalized.Contains("webcam")
            || normalized.Contains("tapo")
            || Regex.IsMatch(normalized, @"\bc\d{2,3}\b");
    }

    private static string? NormalizeOui(string? macAddress)
    {
        if (string.IsNullOrWhiteSpace(macAddress))
        {
            return null;
        }

        var octets = macAddress
            .Split(':', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Take(3)
            .ToArray();

        return octets.Length == 3
            ? string.Join(':', octets).ToUpperInvariant()
            : null;
    }
}