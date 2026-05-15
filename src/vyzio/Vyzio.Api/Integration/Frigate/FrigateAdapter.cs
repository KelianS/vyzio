using Microsoft.Extensions.Logging;
using Vyzio.Application.DTOs.Frigate;
using Vyzio.Application.UseCases.Frigate;
using Vyzio.Application.UseCases.Notifications;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Api.Integration.Frigate;

public sealed class FrigateAdapter(
    FrigateEventContractAdapter contractAdapter,
    IDetectionEventRepository detectionEvents,
    IDetectionNotificationDispatcher detectionNotifications,
    IFrigateRestClient restClient,
    IProfileRepository profileRepository,
    IProfileCameraLinkRepository profileCameraLinks,
    ILogger<FrigateAdapter> logger)
{
    public async Task<bool> ProcessMessageAsync(string topic, string payload, CancellationToken ct = default)
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
            return await restClient.TryGetIdentityAsync(consumedEvent.FrigateEventId, ct) ?? currentIdentity;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Failed to enrich Frigate event {FrigateEventId} via REST; keeping realtime payload only.",
                consumedEvent.FrigateEventId);
            return currentIdentity;
        }
    }

    // Resolves a Frigate sub_label to a Vyzio profile, respecting profile-camera link restrictions (ADR-15).
    // Returns null if no matching profile exists or if the profile is not linked to this camera.
    private async Task<string?> ResolveProfileIdAsync(string? identity, string camera, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(identity))
            return null;

        var allProfiles = await profileRepository.GetAllAsync(ct);
        var profile = allProfiles.FirstOrDefault(p =>
            string.Equals(p.Name, identity, StringComparison.OrdinalIgnoreCase));

        if (profile is null)
            return null;

        // If the profile has camera links defined, only recognize on linked cameras.
        var links = await profileCameraLinks.GetByProfileIdAsync(profile.Id, ct);
        var activeLinks = links.Where(l => l.Enabled).ToList();

        if (activeLinks.Count > 0 && !activeLinks.Any(l => string.Equals(l.CameraId, camera, StringComparison.Ordinal)))
        {
            // Profile exists but not linked to this camera
            return null;
        }

        return profile.Id;
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