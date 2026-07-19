using System.Linq;
using Vyzio.Core.Entities;

namespace Vyzio.Application.DTOs.Cameras;

public sealed record CreateCameraRequest(
    string DisplayName,
    string Host,
    int Port,
    string? Username,
    string? Password,
    string? StreamPath,
    string? SourceType,
    string? VendorFamily = null,
    string? StreamProtocol = null);

public sealed record UpdateCameraRequest(
    string DisplayName,
    string Host,
    int Port,
    string? Username,
    string? Password,
    string? StreamPath,
    string? SourceType,
    string? VendorFamily = null,
    string? StreamProtocol = null,
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
    DiscoveryTechnicalDetailsDto? TechnicalDetails)
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
        DiscoveryTechnicalDetailsDto.From(candidate.TechnicalDetails));
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