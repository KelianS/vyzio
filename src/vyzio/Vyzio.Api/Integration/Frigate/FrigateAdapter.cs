using Microsoft.Extensions.Logging;
using Vyzio.Application.DTOs.Frigate;
using Vyzio.Application.UseCases.Frigate;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Api.Integration.Frigate;

public sealed class FrigateAdapter(
    FrigateEventContractAdapter contractAdapter,
    IObservedEventRepository observedEvents,
    IFrigateRestClient restClient,
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
            var existing = await observedEvents.GetByFrigateEventIdAsync(consumedEvent.FrigateEventId, ct);
            var identity = await TryResolveIdentityAsync(consumedEvent, existing?.Identity, ct);

            if (existing is null)
            {
                await observedEvents.AddAsync(ToObservedEvent(consumedEvent, identity), ct);
                return true;
            }

            ApplyUpdate(existing, consumedEvent, identity);
            await observedEvents.UpdateAsync(existing, ct);
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

    private static ObservedEvent ToObservedEvent(FrigateConsumedEvent consumedEvent, string? identity)
        => new()
        {
            FrigateEventId = consumedEvent.FrigateEventId,
            Lifecycle = consumedEvent.Lifecycle,
            Camera = consumedEvent.Camera,
            Label = consumedEvent.Label,
            Identity = identity,
            Confidence = consumedEvent.Confidence,
            OccurredAt = consumedEvent.OccurredAt,
            HasClip = consumedEvent.HasClip,
            HasSnapshot = consumedEvent.HasSnapshot
        };

    private static void ApplyUpdate(ObservedEvent existing, FrigateConsumedEvent consumedEvent, string? identity)
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
        }
    }
}