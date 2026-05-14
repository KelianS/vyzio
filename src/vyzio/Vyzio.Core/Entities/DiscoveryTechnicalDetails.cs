namespace Vyzio.Core.Entities;

public sealed record DiscoveryTechnicalDetails(
    string? ResolvedHostName,
    IReadOnlyList<int> HttpPortsDetected,
    IReadOnlyList<int> RtspPortsDetected,
    IReadOnlyList<int> OnvifPortsDetected,
    IReadOnlyList<string> RtspPathsDetected);