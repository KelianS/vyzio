using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.Services.CameraDiscovery;

// ADR-32 — final part of Stage 3 (interpretation): merges the (possibly several) per-protocol
// candidates produced for the same host into one, and orders/exposes all of them — including
// device_unknown, lowest priority — so an unrecognized device never disappears silently.
internal sealed class AssistedCameraDiscoveryFormatter
{
    public IReadOnlyList<CameraDiscoveryCandidate> Format(IReadOnlyList<CameraDiscoveryCandidate> candidates)
    {
        return candidates
            .GroupBy(candidate => candidate.Host, StringComparer.OrdinalIgnoreCase)
            .Select(MergeCandidates)
            .OrderByDescending(GetCandidatePriority)
            .ThenBy(candidate => candidate.DisplayName, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static CameraDiscoveryCandidate MergeCandidates(IGrouping<string, CameraDiscoveryCandidate> group)
    {
        var ordered = group
            .OrderByDescending(GetCandidatePriority)
            .ThenByDescending(candidate => candidate.QualificationReasons.Count)
            .ThenBy(candidate => candidate.Port == 0 ? 1 : 0)
            .ToList();

        var primary = ordered[0];
        var hostnameHint = ordered.FirstOrDefault(candidate => string.Equals(candidate.DiscoverySource, "hostname_probe", StringComparison.OrdinalIgnoreCase));
        var vendorProof = ordered.FirstOrDefault(candidate => candidate.VendorFamily is not null);
        var namedCandidate = ordered.FirstOrDefault(candidate => !LooksLikeHostLabel(candidate.DisplayName, candidate.Host));

        var mergedReasons = ordered
            .SelectMany(candidate => candidate.QualificationReasons)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        return primary with
        {
            DisplayName = namedCandidate?.DisplayName ?? hostnameHint?.DisplayName ?? primary.DisplayName,
            Note = primary.Note,
            VendorFamily = vendorProof?.VendorFamily ?? primary.VendorFamily,
            VendorDocumentation = vendorProof?.VendorDocumentation ?? primary.VendorDocumentation,
            QualificationReasons = mergedReasons,
        };
    }

    private static int GetCandidatePriority(CameraDiscoveryCandidate candidate)
    {
        var qualification = candidate.Qualification switch
        {
            "camera_confirmed" => 300,
            "camera_likely" => 200,
            _ => 100,
        };

        // ADR-32: priority ordering lives in one place (DiscoveryProtocolCatalog) shared with the
        // port/label display — an unregistered discoverySource defaults to 0, same as before.
        var discovery = DiscoveryProtocolCatalog.Lookup(candidate.DiscoverySource)?.Priority ?? 0;
        var stream = string.IsNullOrWhiteSpace(candidate.StreamPath) ? 0 : 5;

        return qualification + discovery + stream;
    }

    private static bool LooksLikeHostLabel(string displayName, string host)
    {
        return string.Equals(displayName, host, StringComparison.OrdinalIgnoreCase)
            || string.Equals(displayName, host.Replace('-', ' ').Replace('_', ' '), StringComparison.OrdinalIgnoreCase);
    }
}
