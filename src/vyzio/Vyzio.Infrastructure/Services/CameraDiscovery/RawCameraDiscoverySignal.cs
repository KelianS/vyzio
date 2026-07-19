using Vyzio.Core.Entities;

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
    IReadOnlyList<string> Signals,
    // Set by the port sweep (ADR-32) once a fingerprint has confirmed which protocol actually
    // speaks on this open port — null means "open but no protocol confirmed". PortServiceLabel is
    // the conventional service name to show for such unconfirmed open ports (e.g. "HTTP", "SSH").
    SupportedProtocol? ConfirmedProtocol = null,
    string? PortServiceLabel = null);
