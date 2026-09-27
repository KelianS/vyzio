using Vyzio.Application.UseCases.Cameras;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Notifications;

/// <summary>Why a detection naming a person is signalled or not, before any channel (ADR-58).</summary>
public enum PersonAlertDecision
{
    Signalled,
    NeverSignalled,
    OutsideTheirCameras,
}

/// <summary>
/// Whether the person a detection names is signalled at all (ADR-58).
/// A detection naming no profile is left to the channels.
/// </summary>
public sealed class PersonAlertPolicy(
    DetectionProfileResolver profileResolver,
    IProfileCameraLinkRepository profileCameraLinks,
    CameraDirectory cameras)
{
    public async Task<PersonAlertDecision> DecideAsync(FrigateDetection detection, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(detection);

        var profile = await profileResolver.ResolveProfileAsync(detection.Identity, ct);
        if (profile is null)
            return PersonAlertDecision.Signalled;

        if (profile.AlertMode == ProfileAlertMode.Never)
            return PersonAlertDecision.NeverSignalled;

        var linkedCameraIds = (await profileCameraLinks.GetByProfileIdAsync(profile.Id, ct))
            .Where(link => link.Enabled)
            .Select(link => link.CameraId)
            .ToHashSet(StringComparer.Ordinal);

        // Only an empty list means every camera, including one added later.
        if (linkedCameraIds.Count == 0)
            return PersonAlertDecision.Signalled;

        var camera = await cameras.FindByFrigateNameAsync(detection.Camera, ct);
        return camera is not null && linkedCameraIds.Contains(camera.Id)
            ? PersonAlertDecision.Signalled
            : PersonAlertDecision.OutsideTheirCameras;
    }
}
