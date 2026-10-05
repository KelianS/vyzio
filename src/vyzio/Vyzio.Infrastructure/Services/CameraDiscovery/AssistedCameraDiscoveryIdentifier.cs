using Vyzio.Core.Common;
using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.Services.CameraDiscovery;

// ADR-32 — Stage 3 (interpretation): turns the raw, structured facts produced by
// AssistedCameraDiscoveryProbePipeline (Stages 1-2) into product-facing conclusions: the
// qualification tier and, on a very strong signal only, the vendor (#274).
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
        var vendorFamily = AssistedCameraDiscoveryKnownDevices.VendorProvenBy(signal.ConfirmedProtocol);
        var qualificationReasons = BuildQualificationReasons(signal.StreamPath, signal.Signals);

        return new CameraDiscoveryCandidate(
            signal.DisplayName,
            signal.Host,
            signal.Port,
            signal.SourceType,
            signal.StreamPath,
            signal.DiscoverySource,
            signal.Note,
            DetermineQualification(qualificationReasons),
            vendorFamily,
            qualificationReasons,
            _documentationCatalog.GetByVendorFamily(vendorFamily is { } family ? SnakeCaseEnum.ToSnakeCase(family) : null));
    }

    private static IReadOnlyList<string> BuildQualificationReasons(string? streamPath, IReadOnlyList<string> primaryReasons)
    {
        var reasons = primaryReasons.Distinct(StringComparer.Ordinal).ToList();

        if (!string.IsNullOrWhiteSpace(streamPath) && !reasons.Contains("rtsp_path_known", StringComparer.Ordinal))
        {
            reasons.Add("rtsp_path_known");
        }

        return reasons;
    }

    private static string DetermineQualification(IReadOnlyList<string> qualificationReasons)
    {
        // ADR-32: "camera_port_open" is emitted by the port sweep for any camera-signal port
        // (DiscoveryPortCatalog) — so adding a new protocol with a dedicated port confirms the
        // host automatically, without editing this method.
        if (qualificationReasons.Contains("camera_port_open", StringComparer.Ordinal)
            || qualificationReasons.Contains("onvif_detected", StringComparer.Ordinal)
            || (qualificationReasons.Contains("rtsp_responding", StringComparer.Ordinal)
                && qualificationReasons.Contains("rtsp_path_known", StringComparer.Ordinal)))
        {
            return "camera_confirmed";
        }

        if (qualificationReasons.Contains("rtsp_responding", StringComparer.Ordinal)
            || qualificationReasons.Contains("http_camera_signature", StringComparer.Ordinal)
            || qualificationReasons.Contains("hostname_camera_hint", StringComparer.Ordinal))
        {
            return "camera_likely";
        }

        return "device_unknown";
    }
}
