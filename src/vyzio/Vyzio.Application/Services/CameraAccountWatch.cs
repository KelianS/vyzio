using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.Services;

// Which silent cameras are due for their one probe; kept across readings, one probe per outage (ADR-58).
internal sealed class CameraOutageTracker
{
    private const int SilentReadingsBeforeProbe = 2;
    private readonly Dictionary<string, int> _silentReadings = [];
    private readonly HashSet<string> _probed = [];

    // A refused camera is out of watch, so a reload that failed is owed until one takes (ADR-58 c).
    public bool ReloadPending { get; set; }

    public IReadOnlyList<Camera> DueForProbe(IReadOnlyList<Camera> cameras, FrigateStats stats)
    {
        var watched = cameras.Where(IsWatched).ToList();
        var watchedIds = watched.Select(c => c.Id).ToHashSet();
        // A camera out of watch (refused, disabled, private) starts afresh when it comes back.
        foreach (var gone in _silentReadings.Keys.Where(id => !watchedIds.Contains(id)).ToList()) _silentReadings.Remove(gone);
        _probed.RemoveWhere(id => !watchedIds.Contains(id));

        var fps = stats.Cameras.ToDictionary(c => c.Camera, c => c.Fps, StringComparer.Ordinal);
        var due = new List<Camera>();
        foreach (var camera in watched)
        {
            if (!fps.TryGetValue(camera.FrigateCameraName, out var rate)) continue;
            if (rate > 0)
            {
                _silentReadings.Remove(camera.Id);
                _probed.Remove(camera.Id);
                continue;
            }

            var silent = _silentReadings[camera.Id] = _silentReadings.GetValueOrDefault(camera.Id) + 1;
            if (silent >= SilentReadingsBeforeProbe && _probed.Add(camera.Id)) due.Add(camera);
        }
        return due;
    }

    // DVRIP cameras speak no RTSP on their port, so the probe has nothing to ask them (ADR-58).
    private static bool IsWatched(Camera camera) =>
        camera.StreamProtocol != StreamProtocol.Dvrip
        && camera.IsEnabled
        && string.Equals(camera.ValidationState, "validated", StringComparison.OrdinalIgnoreCase)
        && !camera.PrivacyModeActive
        && camera.AccountRefusedAt is null;
}

// One reading: probe the cameras gone silent, take out of capture the ones whose account is refused (ADR-58).
public sealed class CameraAccountWatch(
    ICameraRepository cameras,
    IFrigateStatsProvider stats,
    IRtspAccountProbe probe,
    IFrigateConfigApplier frigateConfig,
    TimeProvider time,
    ILogger<CameraAccountWatch> logger)
{
    internal async Task ReadAsync(CameraOutageTracker tracker, CancellationToken ct)
    {
        if (await stats.TryGetStatsAsync(ct) is not { } reading) return;

        var all = await cameras.GetAllAsync(ct);
        var refused = false;
        foreach (var camera in tracker.DueForProbe(all, reading))
        {
            RtspAccountCheck check;
            try
            {
                check = await probe.CheckAsync(camera, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
            {
                // One camera that cannot be probed must not leave the others due in this reading unprobed.
                logger.LogWarning(ex, "Camera {CameraId} could not be probed for its account.", camera.Id);
                continue;
            }
            if (check != RtspAccountCheck.Refused) continue;

            logger.LogWarning("Camera {CameraId} refused its account; it leaves capture until the password is fixed.", camera.Id);
            camera.AccountRefusedAt = time.GetUtcNow();
            camera.UpdatedAt = camera.AccountRefusedAt.Value;
            await cameras.UpdateAsync(camera, ct);
            refused = true;
        }

        // One reload for every camera refused in this reading, retried on each reading until it takes.
        if (!refused && !tracker.ReloadPending) return;
        var applied = await frigateConfig.ApplyAsync(all, ct);
        tracker.ReloadPending = !applied.Applied;
        if (!applied.Applied)
            logger.LogError("Capture reload failed after an account refusal; retried at the next reading: {Reason}", applied.Message);
    }
}

internal sealed class CameraAccountWatcherService(
    IServiceScopeFactory scopeFactory,
    TimeProvider time,
    ILogger<CameraAccountWatcherService> logger) : BackgroundService
{
    private static readonly TimeSpan ReadInterval = TimeSpan.FromSeconds(30);
    private readonly CameraOutageTracker _tracker = new();

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<CameraAccountWatch>().ReadAsync(_tracker, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Camera account watch failed; will read again next interval.");
            }

            await Task.Delay(ReadInterval, time, ct);
        }
    }
}
