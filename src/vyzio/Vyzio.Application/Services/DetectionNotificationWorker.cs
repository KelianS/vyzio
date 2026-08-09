using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Vyzio.Application.UseCases.Notifications;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.Services;

// Drains the detection queue outside the MQTT handler, which must never wait (ADR-49).
internal sealed class DetectionNotificationWorker(
    IDetectionNotificationQueue queue,
    IServiceScopeFactory scopeFactory,
    ILogger<DetectionNotificationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        await foreach (var detection in queue.ReadAllAsync(ct))
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var notify = scope.ServiceProvider.GetRequiredService<NotifyDetectionUseCase>();
                await notify.ExecuteAsync(detection, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to notify Frigate event {FrigateEventId}.", detection.EventId);
            }
        }
    }
}
