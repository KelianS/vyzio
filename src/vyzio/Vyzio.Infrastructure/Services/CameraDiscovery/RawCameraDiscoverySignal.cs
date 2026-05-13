namespace Vyzio.Infrastructure.Services.CameraDiscovery;

internal sealed record RawCameraDiscoverySignal(
    string DisplayName,
    string Host,
    int Port,
    string SourceType,
    string? StreamPath,
    string DiscoverySource,
    string? Note,
    string? MacAddress,
    string? ResolvedHostName,
    IReadOnlyList<string> Signals);