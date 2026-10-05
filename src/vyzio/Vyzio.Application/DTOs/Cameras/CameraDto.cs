using Vyzio.Core.Common;
using Vyzio.Core.Entities;

namespace Vyzio.Application.DTOs.Cameras;

public sealed record CameraDto(
    string Id,
    string Slug,
    string DisplayName,
    string SourceType,
    string Host,
    string? Username,
    string Status,
    string ValidationState,
    bool IsEnabled,
    bool PreviewAvailable,
    bool NeedsAttention,
    DateTimeOffset? LastReachabilityCheckAt,
    DateTimeOffset? LastSuccessfulFrameAt,
    DateTimeOffset? DetectedAt,
    string FrigateCameraName,
    bool PrivacyModeActive,
    string? PrivacyModeSource,
    bool PrivacyVendorCut,
    string? PrivacyMiss,
    string? PrivacyMissDetail,
    bool PtzSupported,
    string PrivacyStrategy,
    IReadOnlyList<string> VerifiedCapabilities)
{
    public static CameraDto From(Camera camera, IEnumerable<CameraCapabilityBinding>? verifiedBindings = null) => new(
        camera.Id,
        camera.Slug,
        camera.DisplayName,
        camera.SourceType,
        camera.Host,
        camera.Username,
        CameraStatusDto.StatusOf(camera),
        SnakeCaseEnum.ToSnakeCase(camera.ValidationState),
        camera.IsEnabled,
        camera.LastSuccessfulFrameAt.HasValue,
        !string.Equals(CameraStatusDto.StatusOf(camera), "online", StringComparison.OrdinalIgnoreCase),
        camera.LastReachabilityCheckAt,
        camera.LastSuccessfulFrameAt,
        camera.DetectedAt,
        camera.FrigateCameraName,
        camera.PrivacyModeActive,
        camera.PrivacyModeSource is { } privacyModeSource ? SnakeCaseEnum.ToSnakeCase(privacyModeSource) : null,
        camera.PrivacyVendorCut,
        camera.PrivacyMiss is { } privacyMiss ? SnakeCaseEnum.ToSnakeCase(privacyMiss) : null,
        camera.PrivacyMissDetail,
        camera.PtzSupported,
        SnakeCaseEnum.ToSnakeCase(camera.PrivacyStrategy),
        verifiedBindings?
            .Where(b => b.CameraId == camera.Id)
            .Select(b => SnakeCaseEnum.ToSnakeCase(b.Capability))
            .ToList() ?? []);
}
