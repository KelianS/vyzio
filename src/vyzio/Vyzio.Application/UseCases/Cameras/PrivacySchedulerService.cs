using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Vyzio.Application.UseCases.Scheduling;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

// Evaluates the privacy rules every minute; a manual cut, until the end chosen for it if any, or a manual resume until its range ends, is never overridden (ADR-10, ADR-15).
public sealed class PrivacySchedulerService(
    IServiceScopeFactory scopeFactory,
    PrivacyResumes resumes,
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

        var timedOut = cameras.Where(camera => TimedCutIsOver(camera, now)).ToList();
        if (timedOut.Count > 0)
            await EndTimedCutsAsync(scope.ServiceProvider, timedOut, rules, now, ct);

        foreach (var camera in cameras.Except(timedOut))
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

    private static bool TimedCutIsOver(Camera camera, DateTimeOffset now) =>
        camera is { PrivacyModeActive: true, PrivacyModeSource: PrivacyModeSource.Manual, PrivacyModeUntil: { } until } && now >= until;

    // The chosen hour has come: a camera a range covers stays cut by it, the others resume in one reload (PRIV-07, PRIV-14).
    private async Task EndTimedCutsAsync(
        IServiceProvider services, IReadOnlyList<Camera> timedOut, IReadOnlyList<ScheduleRule> rules, DateTimeOffset now, CancellationToken ct)
    {
        var cameraRepo = services.GetRequiredService<ICameraRepository>();
        var resumed = new List<string>();
        foreach (var camera in timedOut)
        {
            if (!ScheduleRuleCoverage.Covers(rules, camera.Id, now))
            {
                resumed.Add(camera.Id);
                continue;
            }
            // Already cut as the range wants: the range takes the cut over, nothing to ask the camera.
            camera.PrivacyModeSource = PrivacyModeSource.Schedule;
            camera.PrivacyModeUntil = null;
            camera.UpdatedAt = DateTimeOffset.UtcNow;
            await cameraRepo.UpdateAsync(camera, ct);
            logger.LogInformation("PrivacyScheduler: the cut chosen for {Camera} has ended; a range keeps it cut.", camera.DisplayName);
        }

        if (resumed.Count == 0) return;
        try
        {
            await services.GetRequiredService<BatchToggleCameraPrivacyModeUseCase>().ExecuteAsync(resumed, active: false, ct);
            logger.LogInformation("PrivacyScheduler: the cut chosen for every camera has ended; {Count} camera(s) resumed.", resumed.Count);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            // Retried at the next pass: the cameras not yet saved still carry their past end.
            logger.LogWarning(ex, "PrivacyScheduler: could not resume every camera at the end of the chosen cut.");
        }
    }

    private async Task ApplyScheduleAsync(
        ToggleCameraPrivacyModeUseCase toggleUseCase, Camera camera, bool shouldBeActive, CancellationToken ct)
    {
        // Manual activations are never overridden by the scheduler
        if (camera.PrivacyModeSource == PrivacyModeSource.Manual)
            return;

        // A resume lasts while a range covers the camera, then the next range applies (PRIV-07).
        if (!shouldBeActive)
            resumes.End(camera.Id);
        else if (resumes.Holds(camera.Id))
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
