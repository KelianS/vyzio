using Vyzio.Application.DTOs.DetectionEvents;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.DetectionEvents;

/// <summary>
/// Turns Frigate detections into what the screens read, resolving profile and camera name at read
/// time rather than freezing them at ingestion (ADR-49).
/// Scoped: the camera list below is cached for one request, never longer.
/// </summary>
public sealed class DetectionEventContractProjector(
    CameraDirectory cameras,
    DetectionProfileResolver profileResolver,
    IRecordingSettingsRepository recordingSettings)
{
    public async Task<IReadOnlyList<DetectionEventContract>> ToContractsAsync(
        IEnumerable<FrigateDetection> detections,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(detections);

        var installation = await recordingSettings.GetAsync(ct);

        var contracts = new List<DetectionEventContract>();
        foreach (var detection in detections)
        {
            contracts.Add(await ToContractAsync(detection, installation, ct));
        }

        return contracts;
    }

    public async Task<DetectionEventContract> ToContractAsync(
        FrigateDetection detection,
        CancellationToken ct = default)
        => await ToContractAsync(detection, await recordingSettings.GetAsync(ct), ct);

    private async Task<DetectionEventContract> ToContractAsync(
        FrigateDetection detection,
        RecordingSettings installation,
        CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(detection);

        var camera = await cameras.FindByFrigateNameAsync(detection.Camera, ct);
        // A camera Vyzio no longer knows matches no link, so only an unrestricted profile resolves.
        var profileId = await profileResolver.ResolveProfileIdAsync(
            detection.Identity, camera?.Id ?? detection.Camera, ct);

        var retention = camera is null
            ? RetentionPolicy.ForInstallation(installation)
            : RetentionPolicy.Resolve(installation, camera);

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
            detection.HasSnapshot,
            // Past the retention Frigate has deleted the files: saying so beats a broken image (ADR-49).
            MediaExpired: detection.OccurredAt < DateTimeOffset.UtcNow.AddDays(-retention.EventClipDays));
    }
}
