using System.Text.RegularExpressions;

namespace Vyzio.Infrastructure.Services.CameraDiscovery;

internal static class AssistedCameraDiscoveryKnownDevices
{
    public static string? DetectVendorFamily(string? displayName, string? note, string? hostName, string? macAddress)
    {
        var fingerprint = $"{displayName} {note} {hostName}".ToLowerInvariant();
        var oui = NormalizeOui(macAddress);

        if (fingerprint.Contains("v380 pro") || fingerprint.Contains("v380pro") || fingerprint.Contains("v380") || hostName?.StartsWith("MV", StringComparison.Ordinal) == true)
        {
            return "v380_pro";
        }

        if (fingerprint.Contains("tapo") || fingerprint.Contains("tp-link") || fingerprint.Contains("tplink"))
        {
            return "tplink_tapo";
        }

        if (fingerprint.Contains("icsee") || fingerprint.Contains("xmeye") || fingerprint.Contains("wonsdar") || fingerprint.Contains("netcam") || fingerprint.Contains("ieq"))
        {
            return "icsee";
        }

        if (oui is "E0:09:BF")
        {
            return "v380_pro";
        }

        if (oui is "5C:62:8B")
        {
            return "tplink_tapo";
        }

        // Xiongmai Technology — ICSee/XMEye firmware
        if (oui is "00:12:68")
        {
            return "icsee";
        }

        return null;
    }

    public static string FormatVendorFamily(string vendorFamily) => vendorFamily switch
    {
        "v380_pro" => "V380 PRO",
        "tplink_tapo" => "TP-Link Tapo",
        "icsee" => "ICSee",
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
            || normalized.Contains("v380")
            || normalized.Contains("tapo")
            || normalized.Contains("icsee")
            || normalized.Contains("xmeye")
            || Regex.IsMatch(normalized, @"\bc\d{2,3}\b")
            || Regex.IsMatch(normalized, @"^mv\d");
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