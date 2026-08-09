using Vyzio.Application.DTOs.DetectionEvents;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;

namespace Vyzio.Application.UseCases.DetectionEvents;

/// <summary>
/// Turns Frigate detections into what the screens read, resolving profile and camera name at read
/// time rather than freezing them at ingestion (ADR-49).
/// Scoped: the camera list below is cached for one request, never longer.
/// </summary>
public sealed class DetectionEventContractProjector(
    CameraDirectory cameras,
    DetectionProfileResolver profileResolver)
{
    public async Task<IReadOnlyList<DetectionEventContract>> ToContractsAsync(
        IEnumerable<FrigateDetection> detections,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(detections);

        var contracts = new List<DetectionEventContract>();
        foreach (var detection in detections)
        {
            contracts.Add(await ToContractAsync(detection, ct));
        }

        return contracts;
    }

    public async Task<DetectionEventContract> ToContractAsync(
        FrigateDetection detection,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(detection);

        var camera = await cameras.FindByFrigateNameAsync(detection.Camera, ct);
        // A camera Vyzio no longer knows matches no link, so only an unrestricted profile resolves.
        var profileId = await profileResolver.ResolveProfileIdAsync(
            detection.Identity, camera?.Id ?? detection.Camera, ct);

        return new DetectionEventContract(
            detection.EventId,
            detection.Camera,
            // A camera Vyzio no longer knows keeps its Frigate name: naming it nothing would be worse.
            camera?.DisplayName ?? detection.Camera.Replace('_', ' '),
            detection.Label,
            detection.Identity,
            profileId,
            detection.Confidence,
            detection.OccurredAt,
            detection.HasClip,
            detection.HasSnapshot);
    }
}
