namespace Vyzio.Core.Entities;

public sealed record CameraDiscoveryCandidate(
    string DisplayName,
    string Host,
    int Port,
    string SourceType,
    string? StreamPath,
    string DiscoverySource,
    string? Note,
    string? MacAddress);