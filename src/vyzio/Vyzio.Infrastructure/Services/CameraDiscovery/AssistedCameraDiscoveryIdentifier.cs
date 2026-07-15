using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.Services.CameraDiscovery;

// ADR-32 — Stage 3 (interpretation): turns the raw, structured facts produced by
// AssistedCameraDiscoveryProbePipeline (Stages 1-2) into product-facing conclusions — vendor
// family, qualification tier, support level. Only structured evidence feeds these decisions
// (discoverySource, MAC OUI, hostname) — never free-form note text (see DetectVendorFamily).
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
            signal.ResolvedHostName,
            signal.MacAddress,
            signal.DiscoverySource);
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
        // ADR-32: "camera_port_open" is emitted by the port sweep for any camera-signal port
        // (DiscoveryPortCatalog) — so adding a new protocol with a dedicated port confirms the
        // host automatically, without editing this method. The protocol-specific reasons stay for
        // ONVIF-on-80 / KLAP handshakes (no dedicated port) and downstream consumers.
        if (qualificationReasons.Contains("camera_port_open", StringComparer.Ordinal)
            || qualificationReasons.Contains("onvif_detected", StringComparer.Ordinal)
            || qualificationReasons.Contains("tapo_klap_detected", StringComparer.Ordinal)
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