using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.Services.CameraDiscovery;

internal sealed class AssistedCameraDiscoveryIdentifier
{
    private readonly AssistedCameraDiscoveryVendorDocumentationCatalog _documentationCatalog;

    public AssistedCameraDiscoveryIdentifier(AssistedCameraDiscoveryVendorDocumentationCatalog documentationCatalog)
    {
        _documentationCatalog = documentationCatalog;
    }

    public IReadOnlyList<CameraDiscoveryCandidate> Identify(IReadOnlyList<RawCameraDiscoverySignal> rawSignals)
        => rawSignals.Select(Identify).ToList();

    private CameraDiscoveryCandidate Identify(RawCameraDiscoverySignal signal)
    {
        var vendorFamily = AssistedCameraDiscoveryKnownDevices.DetectVendorFamily(
            signal.DisplayName,
            signal.Note,
            signal.ResolvedHostName,
            signal.MacAddress);
        var vendorDocumentation = _documentationCatalog.GetByVendorFamily(vendorFamily);

        var qualificationReasons = BuildQualificationReasons(
            signal.StreamPath,
            vendorFamily,
            signal.MacAddress,
            signal.Signals);

        return new CameraDiscoveryCandidate(
            signal.DisplayName,
            signal.Host,
            signal.Port,
            signal.SourceType,
            signal.StreamPath,
            signal.DiscoverySource,
            signal.Note,
            signal.MacAddress,
            DetermineQualification(qualificationReasons),
            DetermineSupportLevel(vendorFamily),
            vendorFamily,
                qualificationReasons,
                vendorDocumentation);
    }

    private static IReadOnlyList<string> BuildQualificationReasons(
        string? streamPath,
        string? vendorFamily,
        string? macAddress,
        IReadOnlyList<string> primaryReasons)
    {
        var reasons = primaryReasons.Distinct(StringComparer.Ordinal).ToList();

        if (!string.IsNullOrWhiteSpace(streamPath))
        {
            AddReason(reasons, "rtsp_path_known");
        }

        if (!string.IsNullOrWhiteSpace(vendorFamily))
        {
            AddReason(reasons, "vendor_hint_detected");
        }

        if (!string.IsNullOrWhiteSpace(macAddress))
        {
            AddReason(reasons, "mac_address_observed");
        }

        return reasons;
    }

    private static string DetermineQualification(IReadOnlyList<string> qualificationReasons)
    {
        if (qualificationReasons.Contains("onvif_detected", StringComparer.Ordinal)
            || qualificationReasons.Contains("icsee_port_detected", StringComparer.Ordinal)
            || (qualificationReasons.Contains("rtsp_responding", StringComparer.Ordinal)
                && qualificationReasons.Contains("rtsp_path_known", StringComparer.Ordinal)))
        {
            return "camera_confirmed";
        }

        if (qualificationReasons.Contains("rtsp_responding", StringComparer.Ordinal)
            || qualificationReasons.Contains("http_camera_signature", StringComparer.Ordinal)
            || qualificationReasons.Contains("vendor_oui_match", StringComparer.Ordinal)
            || qualificationReasons.Contains("hostname_camera_hint", StringComparer.Ordinal))
        {
            return "camera_likely";
        }

        return "device_unknown";
    }

    private static string DetermineSupportLevel(string? vendorFamily) => vendorFamily switch
    {
        "v380_pro" => "guided",
        "tplink_tapo" => "guided",
        "icsee" => "guided",
        _ => "unknown",
    };

    private static void AddReason(List<string> reasons, string reason)
    {
        if (!reasons.Contains(reason, StringComparer.Ordinal))
        {
            reasons.Add(reason);
        }
    }
}