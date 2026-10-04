using System.Linq;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;

namespace Vyzio.Application.DTOs.Cameras;

// The camera (identity and access) and its stream capability, the one it is born with (ADR-61).
public sealed record CreateCameraRequest(
    string DisplayName,
    string Host,
    string? Username,
    string? Password,
    string? SourceType,
    CreateCameraStreamRequest Stream,
    string? VendorFamily = null);

// The protocol carrying the stream, that protocol's port (null: its usual one) and the main path over RTSP.
public sealed record CreateCameraStreamRequest(string Protocol, int? Port, string? Path);

public sealed record UpdateCameraRequest(
    string DisplayName,
    string Host,
    string? Username,
    string? Password,
    string? SourceType,
    string? VendorFamily = null,
    bool? PtzSupported = null);

public sealed record DiscoverCamerasRequest(
    string? Host,
    int? Port)
{
    public CameraDiscoveryTarget? ToTarget()
        => string.IsNullOrWhiteSpace(Host)
            ? null
            : new CameraDiscoveryTarget(Host.Trim(), Port is > 0 ? Port : null);
}

public sealed record DiscoveredCameraDto(
    string DisplayName,
    string Host,
    int Port,
    string SourceType,
    string? StreamPath,
    bool RtspActive,
    string DiscoverySource,
    string? Note,
    string? MacAddress,
    bool IsSupported,
    string Qualification,
    string SupportLevel,
    string? VendorFamily,
    IReadOnlyList<string> QualificationReasons,
    VendorDocumentationDto? VendorDocumentation,
    DiscoveryTechnicalDetailsDto? TechnicalDetails,
    DiscoveredStreamDto? Stream)
{
    public static DiscoveredCameraDto From(CameraDiscoveryCandidate candidate) => new(
        candidate.DisplayName,
        candidate.Host,
        candidate.Port,
        candidate.SourceType,
        candidate.StreamPath,
        !string.IsNullOrWhiteSpace(candidate.StreamPath),
        candidate.DiscoverySource,
        candidate.Note,
        candidate.MacAddress,
        !string.IsNullOrWhiteSpace(candidate.VendorFamily) || candidate.VendorDocumentation is not null,
        candidate.Qualification,
        candidate.SupportLevel,
        candidate.VendorFamily,
        candidate.QualificationReasons,
        VendorDocumentationDto.From(candidate.VendorDocumentation),
        DiscoveryTechnicalDetailsDto.From(candidate.TechnicalDetails),
        DiscoveredStreamDto.From(candidate.Stream));
}

// The stream the candidate is ready with (null: to prepare), as the add form takes it.
public sealed record DiscoveredStreamDto(string Protocol, int Port, string? Path)
{
    public static DiscoveredStreamDto? From(DiscoveredStream? stream)
        => stream is null ? null : new(SnakeCaseEnum.ToSnakeCase(stream.Protocol), stream.Port, stream.Path);
}

public sealed record DetectedPortSignalDto(string Protocol, string Label, int Port)
{
    public static DetectedPortSignalDto From(DetectedPortSignal signal)
        => new(signal.Protocol, signal.Label, signal.Port);
}

public sealed record DetectedCapabilityDto(string Capability, string Label, IReadOnlyList<string> ProtocolLabels)
{
    public static DetectedCapabilityDto From(DetectedCapability capability)
        => new(capability.Capability, capability.Label, capability.ProtocolLabels);
}

public sealed record DiscoveryTechnicalDetailsDto(
    string? ResolvedHostName,
    IReadOnlyList<DetectedPortSignalDto> DetectedPorts,
    IReadOnlyList<string> RtspPathsDetected,
    IReadOnlyList<DetectedCapabilityDto> Capabilities)
{
    public static DiscoveryTechnicalDetailsDto? From(DiscoveryTechnicalDetails? details)
        => details is null
            ? null
            : new DiscoveryTechnicalDetailsDto(
                details.ResolvedHostName,
                details.DetectedPorts.Select(DetectedPortSignalDto.From).ToList(),
                details.RtspPathsDetected,
                details.Capabilities.Select(DetectedCapabilityDto.From).ToList());
}

public sealed record VendorDocumentationDto(
    string VendorFamily,
    string Markdown)
{
    public static VendorDocumentationDto? From(VendorDocumentation? documentation)
        => documentation is null
            ? null
            : new VendorDocumentationDto(
                documentation.VendorFamily,
                documentation.Markdown);
}

public sealed record VendorAssistanceRequestDto(
    string? VendorFamily,
    string? StreamPath,
    bool Connected);

public sealed record VendorAssistanceDto(
    string VendorFamily,
    string Markdown)
{
    public static VendorAssistanceDto? From(VendorDocumentation? documentation)
        => documentation is null ? null : new VendorAssistanceDto(documentation.VendorFamily, documentation.Markdown);
}

public sealed record ApplyCameraResultDto(
    bool Applied,
    string Message,
    string ConfigPath,
    CameraStatusDto Camera);

public sealed record ApplyCameraConfigurationResultDto(
    bool Applied,
    string Message,
    string ConfigPath,
    int CameraCount);

public sealed record DeleteCameraResultDto(
    bool Deleted,
    string Message,
    string ConfigPath);
