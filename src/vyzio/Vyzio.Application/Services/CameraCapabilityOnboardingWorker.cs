using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.Services;

internal sealed class CameraCapabilityOnboardingWorker(
    ICameraCapabilityOnboardingQueue queue,
    IServiceScopeFactory scopeFactory,
    ILogger<CameraCapabilityOnboardingWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            string cameraId;
            try
            {
                cameraId = await queue.DequeueAsync(ct);
            }
            catch (OperationCanceledException)
            {
                break;
            }

            await using var scope = scopeFactory.CreateAsyncScope();
            var useCase = scope.ServiceProvider.GetRequiredService<SeedAndProbePresetsUseCase>();
            try
            {
                logger.LogInformation("Starting capability probe for camera {CameraId}.", cameraId);
                await useCase.ExecuteAsync(cameraId, ct);
                logger.LogInformation("Capability probe completed for camera {CameraId}.", cameraId);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Capability probe failed for camera {CameraId}.", cameraId);
            }
        }
    }
}
