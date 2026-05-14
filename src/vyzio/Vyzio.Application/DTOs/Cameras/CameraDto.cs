using Vyzio.Core.Entities;

namespace Vyzio.Application.DTOs.Cameras;

public sealed record CameraDto(
    string Id,
    string Slug,
    string DisplayName,
    string SourceType,
    string Host,
    int Port,
    string? Username,
    string? StreamPath,
    string Status,
    string ValidationState,
    bool IsEnabled,
    bool PreviewAvailable,
    bool NeedsAttention,
    DateTimeOffset? LastReachabilityCheckAt,
    DateTimeOffset? LastSuccessfulFrameAt,
    string? FrigateCameraName,
    string? VendorFamily)
{
    public static CameraDto From(Camera camera) => new(
        camera.Id,
        camera.Slug,
        camera.DisplayName,
        camera.SourceType,
        camera.Host,
        camera.Port,
        camera.Username,
        camera.StreamPath,
        camera.Status,
        camera.ValidationState,
        camera.IsEnabled,
        camera.LastSuccessfulFrameAt.HasValue,
        !string.Equals(camera.Status, "online", StringComparison.OrdinalIgnoreCase),
        camera.LastReachabilityCheckAt,
        camera.LastSuccessfulFrameAt,
        camera.FrigateCameraName,
        camera.VendorFamily);
}