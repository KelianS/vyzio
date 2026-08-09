using Microsoft.Extensions.Logging;
using Vyzio.Application.DTOs.Frigate;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Frigate;

public sealed class IngestFrigateEventUseCase(
    FrigateEventContractAdapter contractAdapter,
    IDetectionNotificationQueue notificationQueue,
    ILogger<IngestFrigateEventUseCase> logger)
{
    // Parses, filters, hands over — and never waits: the MQTT client processes the next message meanwhile (ADR-49).
    public Task<bool> ExecuteAsync(string topic, string payload, CancellationToken ct = default)
    {
        if (!contractAdapter.TryParseRelevantEvent(payload, out var consumedEvent) || consumedEvent is null)
        {
            return Task.FromResult(false);
        }

        // Vyzio stores nothing anymore: only the end of an event can trigger anything (ADR-49).
        if (!string.Equals(consumedEvent.Lifecycle, "end", StringComparison.OrdinalIgnoreCase))
        {
            return Task.FromResult(false);
        }

        if (!notificationQueue.TryEnqueue(ToDetection(consumedEvent)))
        {
            logger.LogWarning(
                "Detection queue saturated: dropped Frigate event {FrigateEventId} from topic {Topic}.",
                consumedEvent.FrigateEventId, topic);
            return Task.FromResult(false);
        }

        return Task.FromResult(true);
    }

    private static FrigateDetection ToDetection(FrigateConsumedEvent consumedEvent)
        => new(
            consumedEvent.FrigateEventId,
            consumedEvent.Camera,
            consumedEvent.Label,
            Identity: null,
            consumedEvent.Confidence,
            consumedEvent.OccurredAt,
            consumedEvent.HasClip,
            consumedEvent.HasSnapshot);
}
