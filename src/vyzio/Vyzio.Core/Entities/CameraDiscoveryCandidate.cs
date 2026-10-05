namespace Vyzio.Core.Entities;

public sealed record CameraDiscoveryCandidate(
    string DisplayName,
    string Host,
    int Port,
    string SourceType,
    string? StreamPath,
    string DiscoverySource,
    string? Note,
    string Qualification,
    // Set only on a very strong signal, and only to pick the vendor help (ADR-71).
    VendorFamily? VendorFamily,
    IReadOnlyList<string> QualificationReasons,
    VendorDocumentation? VendorDocumentation = null,
    DiscoveryTechnicalDetails? TechnicalDetails = null,
    DiscoveredStream? Stream = null);

// The video stream discovery found reachable as is, over the first stream protocol that serves it; its path only over RTSP.
public sealed record DiscoveredStream(SupportedProtocol Protocol, int Port, string? Path);
