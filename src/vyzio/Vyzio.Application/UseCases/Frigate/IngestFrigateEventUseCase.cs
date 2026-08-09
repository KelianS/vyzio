using Microsoft.Extensions.Logging;
using Vyzio.Application.DTOs.Frigate;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Application.UseCases.Notifications;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Frigate;

public sealed class IngestFrigateEventUseCase(
    FrigateEventContractAdapter contractAdapter,
    IDetectionEventRepository detectionEvents,
    IDetectionNotificationDispatcher detectionNotifications,
    IFrigateEventReader eventReader,
    CameraDirectory cameras,
    DetectionProfileResolver profileResolver,
    ILogger<IngestFrigateEventUseCase> logger)
{
    public async Task<bool> ExecuteAsync(string topic, string payload, CancellationToken ct = default)
    {
        if (!contractAdapter.TryParseRelevantEvent(payload, out var consumedEvent) || consumedEvent is null)
        {
            return false;
        }

        try
        {
            var existing = await detectionEvents.GetByFrigateEventIdAsync(consumedEvent.FrigateEventId, ct);
            var identity = await TryResolveIdentityAsync(consumedEvent, existing?.Identity, ct);
            var profileId = await ResolveProfileIdAsync(identity, consumedEvent.Camera, ct);

            if (existing is null)
            {
                var detectionEvent = ToDetectionEvent(consumedEvent, identity, profileId);
                await detectionEvents.AddAsync(detectionEvent, ct);
                await detectionNotifications.ExecuteAsync(detectionEvent, ct);
                return true;
            }

            ApplyUpdate(existing, consumedEvent, identity, profileId);
            await detectionEvents.UpdateAsync(existing, ct);
            await detectionNotifications.ExecuteAsync(existing, ct);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "Failed to process Frigate event from topic {Topic} for payload mapped to Vyzio.",
                topic);
            return false;
        }
    }

    private async Task<string?> TryResolveIdentityAsync(
        FrigateConsumedEvent consumedEvent,
        string? currentIdentity,
        CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(currentIdentity) || consumedEvent.Lifecycle == "end")
        {
            return currentIdentity;
        }

        try
        {
            return await eventReader.TryGetIdentityAsync(consumedEvent.FrigateEventId, ct) ?? currentIdentity;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Failed to enrich Frigate event {FrigateEventId} via REST; keeping realtime payload only.",
                consumedEvent.FrigateEventId);
            return currentIdentity;
        }
    }

    private async Task<string?> ResolveProfileIdAsync(string? identity, string frigateCamera, CancellationToken ct)
    {
        var camera = await cameras.FindByFrigateNameAsync(frigateCamera, ct);
        return await profileResolver.ResolveProfileIdAsync(identity, camera?.Id ?? frigateCamera, ct);
    }

    private static DetectionEvent ToDetectionEvent(FrigateConsumedEvent consumedEvent, string? identity, string? profileId)
        => new()
        {
            FrigateEventId = consumedEvent.FrigateEventId,
            Lifecycle = consumedEvent.Lifecycle,
            Camera = consumedEvent.Camera,
            Label = consumedEvent.Label,
            Identity = identity,
            ProfileId = profileId,
            Confidence = consumedEvent.Confidence,
            OccurredAt = consumedEvent.OccurredAt,
            HasClip = consumedEvent.HasClip,
            HasSnapshot = consumedEvent.HasSnapshot
        };

    private static void ApplyUpdate(DetectionEvent existing, FrigateConsumedEvent consumedEvent, string? identity, string? profileId)
    {
        existing.Lifecycle = consumedEvent.Lifecycle;
        existing.Camera = consumedEvent.Camera;
        existing.Label = consumedEvent.Label;
        existing.Confidence = consumedEvent.Confidence;
        existing.OccurredAt = consumedEvent.OccurredAt;
        existing.HasClip = consumedEvent.HasClip;
        existing.HasSnapshot = consumedEvent.HasSnapshot;

        if (!string.IsNullOrWhiteSpace(identity))
        {
            existing.Identity = identity;
            existing.ProfileId = profileId;
        }
    }
}
