using Vyzio.Core.Entities;

namespace Vyzio.Application.DTOs.Profiles;

public sealed record ProfileCameraLinkDto(
    string LinkId,
    string ProfileId,
    string ProfileName,
    string CameraId,
    string? CameraName,
    bool Enabled);

public sealed record SetCameraProfileLinksRequest(IReadOnlyList<string> ProfileIds);
public sealed record SetProfileCameraLinksRequest(IReadOnlyList<string> CameraIds);
