namespace Vyzio.Core.Entities;

// One entry per open (protocol, port) observed on the host — pure fact. Protocol/Label come from
// the backend port catalog (ADR-32); the frontend only displays them.
public sealed record DetectedPortSignal(string Protocol, string Label, int Port);

// One capability the host appears to support, with every detected protocol that can serve it.
// Naturally many-to-many: a capability can list several protocols (PTZ via ONVIF and V380), and a
// protocol appears under several capabilities (ONVIF under PTZ and ImageSettings). Derived by
// crossing detected protocols with ICapabilityProviderRegistry.GetRegisteredProtocols — Stream
// included, since it is now a first-class capability with registered providers (ADR-32).
public sealed record DetectedCapability(string Capability, string Label, IReadOnlyList<string> ProtocolLabels);

public sealed record DiscoveryTechnicalDetails(
    string? ResolvedHostName,
    IReadOnlyList<DetectedPortSignal> DetectedPorts,
    IReadOnlyList<string> RtspPathsDetected,
    IReadOnlyList<DetectedCapability> Capabilities);
