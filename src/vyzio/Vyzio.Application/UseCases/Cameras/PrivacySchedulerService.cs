using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Vyzio.Application.UseCases.Scheduling;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

// Evaluates the privacy rules every minute; a manual activation is never overridden (ADR-20, ADR-63).
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
        var ruleRepo = scope.ServiceProvider.GetRequiredService<IScheduleRuleRepository>();
        var cameraRepo = scope.ServiceProvider.GetRequiredService<ICameraRepository>();
        var toggleUseCase = scope.ServiceProvider.GetRequiredService<ToggleCameraPrivacyModeUseCase>();

        var now = TimeZoneInfo.ConvertTime(time.GetUtcNow(), timeZone);
        var rules = await ruleRepo.GetByKindAsync(ScheduleRuleKind.Privacy, ct);
        var cameras = await cameraRepo.GetAllAsync(ct);

        foreach (var camera in cameras)
        {
            try
            {
                await ApplyScheduleAsync(toggleUseCase, camera, ScheduleRuleCoverage.Covers(rules, camera.Id, now), ct);
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
