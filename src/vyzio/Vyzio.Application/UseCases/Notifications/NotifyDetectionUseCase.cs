using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Notifications;

/// <summary>
/// Everything the MQTT handler must not do itself: read the identity back from Frigate, then send (ADR-49).
/// </summary>
public sealed class NotifyDetectionUseCase(
    IFrigateEventReader eventReader,
    IDetectionNotificationDispatcher dispatcher,
    ILogger<NotifyDetectionUseCase> logger)
{
    public async Task<bool> ExecuteAsync(FrigateDetection detection, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(detection);

        var identity = await TryResolveIdentityAsync(detection.EventId, ct);
        return await dispatcher.ExecuteAsync(detection with { Identity = identity }, ct);
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
}
