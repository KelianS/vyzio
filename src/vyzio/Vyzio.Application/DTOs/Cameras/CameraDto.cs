using Vyzio.Core.Common;
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
    string StreamProtocol,
    string Status,
    string ValidationState,
    bool IsEnabled,
    bool PreviewAvailable,
    bool NeedsAttention,
    DateTimeOffset? LastReachabilityCheckAt,
    DateTimeOffset? LastSuccessfulFrameAt,
    string FrigateCameraName,
    string? VendorFamily,
    bool PrivacyModeActive,
    string? PrivacyModeSource,
    bool PrivacyVendorCut,
    bool PtzSupported,
    string PrivacyStrategy,
    IReadOnlyList<string> SupportedProtocols,
    IReadOnlyList<string> VerifiedCapabilities)
{
    public static CameraDto From(Camera camera, IEnumerable<CameraCapabilityBinding>? verifiedBindings = null) => new(
        camera.Id,
        camera.Slug,
        camera.DisplayName,
        camera.SourceType,
        camera.Host,
        camera.Port,
        camera.Username,
        camera.StreamPath,
        SnakeCaseEnum.ToSnakeCase(camera.StreamProtocol),
        camera.Status,
        camera.ValidationState,
        camera.IsEnabled,
        camera.LastSuccessfulFrameAt.HasValue,
        !string.Equals(camera.Status, "online", StringComparison.OrdinalIgnoreCase),
        camera.LastReachabilityCheckAt,
        camera.LastSuccessfulFrameAt,
        camera.FrigateCameraName,
        camera.VendorFamily is { } vendorFamily ? SnakeCaseEnum.ToSnakeCase(vendorFamily) : null,
        camera.PrivacyModeActive,
        camera.PrivacyModeSource is { } privacyModeSource ? SnakeCaseEnum.ToSnakeCase(privacyModeSource) : null,
        camera.PrivacyVendorCut,
        camera.PtzSupported,
        SnakeCaseEnum.ToSnakeCase(camera.PrivacyStrategy),
        camera.GetSupportedProtocols().Select(p => SnakeCaseEnum.ToSnakeCase(p)).ToList(),
        verifiedBindings?
            .Where(b => b.CameraId == camera.Id)
            .Select(b => SnakeCaseEnum.ToSnakeCase(b.Capability))
            .ToList() ?? []);
}
