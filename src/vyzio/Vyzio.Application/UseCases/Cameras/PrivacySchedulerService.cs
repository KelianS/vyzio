using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

// Evaluates active privacy schedules every minute and activates/deactivates cameras accordingly.
// Rule: manual source takes priority — the scheduler never overrides a manual activation.
public sealed class PrivacySchedulerService(
    IServiceScopeFactory scopeFactory,
    TimeZoneInfo timeZone,
    TimeProvider time,
    ILogger<PrivacySchedulerService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("PrivacySchedulerService started (timezone: {Tz}).", timeZone.Id);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await EvaluateSchedulesAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "PrivacySchedulerService encountered an error during schedule evaluation.");
            }

            // Wait until the start of the next minute
            var now = time.GetUtcNow();
            var nextMinute = now.AddSeconds(60 - now.Second).AddMilliseconds(-now.Millisecond);
            var delay = nextMinute - time.GetUtcNow();
            if (delay > TimeSpan.Zero)
                await Task.Delay(delay, time, stoppingToken);
        }
    }

    private async Task EvaluateSchedulesAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var privacyRepo = scope.ServiceProvider.GetRequiredService<ICameraPrivacyRepository>();
        var cameraRepo = scope.ServiceProvider.GetRequiredService<ICameraRepository>();
        var toggleUseCase = scope.ServiceProvider.GetRequiredService<ToggleCameraPrivacyModeUseCase>();

        var now = TimeZoneInfo.ConvertTime(time.GetUtcNow(), timeZone);
        var currentDay = (int)now.DayOfWeek;
        var currentTime = now.TimeOfDay;

        var schedules = await privacyRepo.GetAllActiveSchedulesAsync(ct);
        var cameras = await cameraRepo.GetAllAsync(ct);

        // Group active schedules by camera to determine per-camera desired state
        var desiredActive = cameras.ToDictionary(c => c.Id, _ => false);

        foreach (var schedule in schedules)
        {
            if (schedule.Covers(currentDay, currentTime))
                desiredActive[schedule.CameraId] = true;
        }

        foreach (var camera in cameras)
        {
            try
            {
                await ApplyScheduleAsync(toggleUseCase, camera, desiredActive.TryGetValue(camera.Id, out var v) && v, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
            {
                // One camera failing must not leave every camera after it outside its schedule.
                logger.LogWarning(ex, "PrivacyScheduler: could not apply the schedule to {Camera}.", camera.DisplayName);
            }
        }
    }

    private async Task ApplyScheduleAsync(
        ToggleCameraPrivacyModeUseCase toggleUseCase, Camera camera, bool shouldBeActive, CancellationToken ct)
    {
        // Manual activations are never overridden by the scheduler
        if (camera.PrivacyModeSource == PrivacyModeSource.Manual)
            return;

        var currentlyActive = camera.PrivacyModeActive;

        if (shouldBeActive && !currentlyActive)
        {
            logger.LogInformation("PrivacyScheduler: activating privacy mode on {Camera} (schedule).", camera.DisplayName);
            await toggleUseCase.ExecuteAsync(camera.Id, active: true, source: PrivacyModeSource.Schedule, ct);
        }
        else if (!shouldBeActive && currentlyActive && camera.PrivacyModeSource == PrivacyModeSource.Schedule)
        {
            logger.LogInformation("PrivacyScheduler: deactivating privacy mode on {Camera} (schedule ended).", camera.DisplayName);
            await toggleUseCase.ExecuteAsync(camera.Id, active: false, source: PrivacyModeSource.Schedule, ct);
        }
    }
}
