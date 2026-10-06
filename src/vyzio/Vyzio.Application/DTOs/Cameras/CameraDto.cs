using Vyzio.Application.DTOs.Scheduling;
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
    IReadOnlyList<string> VerifiedCapabilities,
    IReadOnlyList<string> LiveQualities,
    PrivacyResumeDto? PrivacyResume)
{
    public static CameraDto From(
        Camera camera,
        IEnumerable<CameraCapabilityBinding>? verifiedBindings = null,
        PrivacyResumeDto? privacyResume = null) => new(
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
            .ToList() ?? [],
        camera.LiveQualities.Select(SnakeCaseEnum.ToSnakeCase).ToList(),
        privacyResume);
}

/// <summary>A surveillance resumed by hand inside a Privacy range and the house moment it ends (null: never); only the camera list fills it (SPECS 9.2).</summary>
public sealed record PrivacyResumeDto(HouseClockDto? Until);
