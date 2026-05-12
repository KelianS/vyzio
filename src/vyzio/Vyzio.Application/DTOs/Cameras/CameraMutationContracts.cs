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
    string? DetectionPreset);

public sealed record DiscoveredCameraDto(
    string DisplayName,
    string Host,
    int Port,
    string SourceType,
    string? StreamPath,
    string DiscoverySource,
    string? Note)
{
    public static DiscoveredCameraDto From(CameraDiscoveryCandidate candidate) => new(
        candidate.DisplayName,
        candidate.Host,
        candidate.Port,
        candidate.SourceType,
        candidate.StreamPath,
        candidate.DiscoverySource,
        candidate.Note);
}

public sealed record ApplyCameraResultDto(
    bool Applied,
    string Message,
    string ConfigPath,
    CameraStatusDto Camera);