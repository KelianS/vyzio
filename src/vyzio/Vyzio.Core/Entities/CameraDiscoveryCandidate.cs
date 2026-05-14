namespace Vyzio.Core.Entities;

public sealed record CameraDiscoveryCandidate(
    string DisplayName,
    string Host,
    int Port,
    string SourceType,
    string? StreamPath,
    string DiscoverySource,
    string? Note,
    string? MacAddress,
    string Qualification,
    string SupportLevel,
    string? VendorFamily,
    IReadOnlyList<string> QualificationReasons,
    VendorDocumentation? VendorDocumentation = null,
    DiscoveryTechnicalDetails? TechnicalDetails = null);