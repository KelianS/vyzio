using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.DetectionEvents;

/// <summary>
/// Erases one detection for good (SPECS 6.2): Frigate first, and Vyzio's notification rows only once
/// Frigate has let it go, so a refusal leaves both sides as they were.
/// </summary>
public sealed class DeleteDetectionUseCase(
    IFrigateDetectionEraser eraser,
    INotificationRepository notifications,
    ILogger<DeleteDetectionUseCase> logger)
{
    public async Task<DetectionErasure> ExecuteAsync(string frigateEventId, CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(frigateEventId);

        var erasure = await eraser.EraseAsync(frigateEventId, ct);
        // A detection Frigate no longer knows leaves rows pointing at nothing: they go as well.
        if (erasure == DetectionErasure.InProgress)
            return erasure;

        // The messages already delivered stay where they were received; only Vyzio's trace of them goes.
        var removed = await notifications.DeleteForEventAsync(frigateEventId, ct);
        logger.LogInformation(
            "Detection {EventId} {Erasure}, with {NotificationCount} notification rows removed",
            frigateEventId, erasure, removed);
        return erasure;
    }
}
