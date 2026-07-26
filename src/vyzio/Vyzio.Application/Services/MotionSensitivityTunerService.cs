using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.Services;

// I/O half of the motion sensitivity loop (ADR-35): samples Frigate, asks MotionSensitivityTuner
// what to do, applies the answer over MQTT and persists it. All stepping rules live in the tuner.
internal sealed class MotionSensitivityTunerService(
    IServiceScopeFactory scopeFactory,
    MotionSensitivityTuner tuner,
    MotionTuningOptions options,
    ILogger<MotionSensitivityTunerService> logger) : BackgroundService
{
    // Frigate's fps figures are rolling averages; sampling before it has served frames for a while
    // would steer on noise.
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(2);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (!options.Enabled)
        {
            logger.LogInformation("Motion sensitivity auto-tuning is disabled.");
            return;
        }

        logger.LogInformation(
            "Motion sensitivity auto-tuning started: sampling every {Interval}, deciding on the P{Percentile:P0} "
                + "of a {Window} window once it covers {Coverage}.",
            options.SampleInterval, options.AggregationPercentile, options.AggregationWindow,
            options.MinimumWindowCoverage);

        await Task.Delay(StartupDelay, ct);

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await TuneAllAsync(ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Motion sensitivity tuning pass failed; will retry next interval.");
            }

            await Task.Delay(options.SampleInterval, ct);
        }
    }

    private async Task TuneAllAsync(CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var statsProvider = scope.ServiceProvider.GetRequiredService<IFrigateStatsProvider>();

        var stats = await statsProvider.TryGetStatsAsync(ct);
        if (stats is null)
        {
            // Frigate down or restarting — never step a level on absent data.
            logger.LogDebug("Motion tuning pass skipped: Frigate statistics unavailable.");
            return;
        }

        var byName = stats.Cameras.ToDictionary(c => c.Camera, StringComparer.OrdinalIgnoreCase);
        var cameras = scope.ServiceProvider.GetRequiredService<ICameraRepository>();
        var publisher = scope.ServiceProvider.GetRequiredService<IFrigateMotionSettingsPublisher>();
        var now = DateTimeOffset.UtcNow;

        foreach (var camera in await cameras.GetAllAsync(ct))
        {
            if (ct.IsCancellationRequested) break;

            var frigateName = camera.FrigateCameraName;
            if (string.IsNullOrWhiteSpace(frigateName)) continue;

            var eligible = camera.IsEnabled
                && !camera.PrivacyModeActive
                && string.Equals(camera.ValidationState, "validated", StringComparison.OrdinalIgnoreCase);

            if (!eligible || camera.MotionSensitivityPinned)
            {
                // Drop any partial count so a later re-enable starts clean rather than aged.
                tuner.Forget(camera.Id);
                continue;
            }

            if (!byName.TryGetValue(frigateName, out var fps) || fps.Fps <= 0)
            {
                // Camera asleep, offline or not yet serving frames — nothing to characterise.
                logger.LogDebug("Motion tuning skipped for {Camera}: no frames being served.", frigateName);
                continue;
            }

            var ratio = fps.DetectionFps / fps.Fps;
            var decision = tuner.Evaluate(camera.Id, camera.MotionSensitivity, ratio, now);

            logger.LogDebug(
                "Motion tuning {Camera}: sample {Ratio:F2} inferences/frame, level {Level}, "
                    + "{Samples} samples, aggregate {Aggregate}, outcome {Outcome}.",
                frigateName, ratio, camera.MotionSensitivity, decision.SampleCount,
                decision.Aggregate?.ToString("F2") ?? "n/a", decision.Outcome);

            if (decision.NextLevel is not { } next) continue;

            if (!await publisher.TryPublishSensitivityAsync(frigateName, next, ct))
            {
                // Not applied, so not persisted — the loop will re-observe and try again.
                continue;
            }

            logger.LogInformation(
                "Camera {Camera} motion sensitivity {Old} → {New} (aggregate {Aggregate:F2} inferences/frame).",
                frigateName, camera.MotionSensitivity, next, decision.Aggregate);

            camera.MotionSensitivity = next;
            camera.UpdatedAt = now;
            await cameras.UpdateAsync(camera, ct);
        }
    }
}
