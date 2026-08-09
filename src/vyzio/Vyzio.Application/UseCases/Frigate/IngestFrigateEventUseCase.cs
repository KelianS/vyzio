using Microsoft.Extensions.Logging;
using Vyzio.Application.DTOs.Frigate;
using Vyzio.Application.UseCases.Notifications;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Frigate;

public sealed class IngestFrigateEventUseCase(
    FrigateEventContractAdapter contractAdapter,
    IDetectionNotificationDispatcher detectionNotifications,
    IFrigateEventReader eventReader,
    ILogger<IngestFrigateEventUseCase> logger)
{
    public async Task<bool> ExecuteAsync(string topic, string payload, CancellationToken ct = default)
    {
        if (!contractAdapter.TryParseRelevantEvent(payload, out var consumedEvent) || consumedEvent is null)
        {
            return false;
        }

        // Vyzio stores nothing anymore: only the end of an event can trigger anything (ADR-49).
        if (!string.Equals(consumedEvent.Lifecycle, "end", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        try
        {
            var identity = await TryResolveIdentityAsync(consumedEvent.FrigateEventId, ct);
            await detectionNotifications.ExecuteAsync(ToDetection(consumedEvent, identity), ct);
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

    private async Task<string?> TryResolveIdentityAsync(string frigateEventId, CancellationToken ct)
    {
        try
        {
            return await eventReader.TryGetIdentityAsync(frigateEventId, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Failed to enrich Frigate event {FrigateEventId} via REST; keeping realtime payload only.",
                frigateEventId);
            return null;
        }
    }

    private static FrigateDetection ToDetection(FrigateConsumedEvent consumedEvent, string? identity)
        => new(
            consumedEvent.FrigateEventId,
            consumedEvent.Camera,
            consumedEvent.Label,
            identity,
            consumedEvent.Confidence,
            consumedEvent.OccurredAt,
            consumedEvent.HasClip,
            consumedEvent.HasSnapshot);
}
