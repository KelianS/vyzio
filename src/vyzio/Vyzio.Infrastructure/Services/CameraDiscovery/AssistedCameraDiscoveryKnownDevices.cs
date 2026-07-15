using System.Text.RegularExpressions;

namespace Vyzio.Infrastructure.Services.CameraDiscovery;

internal static class AssistedCameraDiscoveryKnownDevices
{
    // ADR-32 (interpretation stage): vendor family is derived only from structured evidence —
    // a confirmed protocol handshake (discoverySource), the MAC OUI, or the hostname — never
    // from human-readable note text. Note text is free-form explanation for the user and must
    // not double as a fingerprinting input (a DVRIP note mentioning "ICSee, Annke, Sannce" as
    // examples of DVRIP-using OEMs previously caused every DVRIP responder to be mislabeled
    // "icsee" by accident, even Annke/Sannce hardware — DVRIP is a shared chipset protocol,
    // not vendor-specific, unlike V380/KLAP below).
    public static string? DetectVendorFamily(string? displayName, string? hostName, string? macAddress, string? discoverySource)
    {
        // A confirmed V380/KLAP handshake is definitional, not a guess: only that vendor's
        // firmware speaks that protocol on that port.
        if (discoverySource is "v380_probe")
        {
            return "v380_pro";
        }

        if (discoverySource is "tapo_klap_probe")
        {
            return "tplink_tapo";
        }

        var fingerprint = $"{displayName} {hostName}".ToLowerInvariant();
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
        => !string.IsNullOrWhiteSpace(DetectVendorFamily(null, null, macAddress, null));

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