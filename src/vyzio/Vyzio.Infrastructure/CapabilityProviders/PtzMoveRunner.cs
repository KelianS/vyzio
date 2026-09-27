using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.CapabilityProviders;

// Paces PTZ moves for every protocol, one at a time per camera, on the injected clock (ADR-60).
internal sealed class PtzMoveRunner(TimeProvider time, ILogger<PtzMoveRunner> logger)
{
    // How long a move waits for the previous one of the same camera before it is skipped.
    public static readonly TimeSpan BusyWait = TimeSpan.FromMilliseconds(300);

    // A held move lasts at least this long, so the shortest press still turns the motor; to tune on hardware (ADR-60).
    public static readonly TimeSpan MinimumHold = TimeSpan.FromMilliseconds(200);

    private readonly ConcurrentDictionary<string, SemaphoreSlim> _running = new();

    // One discrete move; false when skipped because another move of this camera was still running (ADR-59).
    public async Task<bool> RunAsync(Camera camera, Func<CancellationToken, Task> move, CancellationToken ct)
    {
        if (await AcquireAsync(camera, ct) is not { } running) return false;
        try
        {
            await move(ct);
            return true;
        }
        finally
        {
            running.Release();
        }
    }

    // A move then a stop that leaves `duration` after it, whatever the network; false when skipped.
    public Task<bool> RunTimedAsync(
        Camera camera, Func<CancellationToken, Task> move, Func<CancellationToken, Task> stop, TimeSpan duration, CancellationToken ct)
        => RunAsync(camera, token => MoveForAsync(move, stop, duration, token), ct);

    // Starts a move stopped once released and MinimumHold after it went out; null when skipped, the move's error raised once stopped.
    public async Task<Task<TimeSpan>?> HoldAsync(
        Camera camera, Func<CancellationToken, Task> move, Func<CancellationToken, Task> stop, Task released, CancellationToken ct)
    {
        if (await AcquireAsync(camera, ct) is not { } running) return null;
        var sentAt = time.GetTimestamp();
        var moved = Send(move, ct);
        var stopped = StopWhenReleasedAsync(sentAt, moved, stop, released, running);
        try
        {
            await moved;
        }
        catch (Exception)
        {
            await stopped;
            throw;
        }
        return stopped;
    }

    private async Task<SemaphoreSlim?> AcquireAsync(Camera camera, CancellationToken ct)
    {
        var running = _running.GetOrAdd(camera.Id, _ => new SemaphoreSlim(1, 1));
        using var busy = new CancellationTokenSource(BusyWait, time);
        using var wait = CancellationTokenSource.CreateLinkedTokenSource(ct, busy.Token);
        try
        {
            await running.WaitAsync(wait.Token);
            return running;
        }
        catch (OperationCanceledException) when (busy.IsCancellationRequested && !ct.IsCancellationRequested)
        {
            logger.LogDebug("PTZ move skipped for {Camera}: the previous move is still running.", camera.DisplayName);
            return null;
        }
    }

    // The timer starts as the move goes out and the stop does not wait for its answer: the network does not set the length.
    private async Task MoveForAsync(
        Func<CancellationToken, Task> move, Func<CancellationToken, Task> stop, TimeSpan duration, CancellationToken ct)
    {
        var elapsed = Task.Delay(duration, time, ct);
        var moved = move(ct);

        // A move the camera refused before the timer ran out never started: it is stopped at once.
        await Task.WhenAny(elapsed, moved);
        if (!moved.IsFaulted)
            await elapsed.ConfigureAwait(ConfigureAwaitOptions.SuppressThrowing);

        // Cancelled or not, the stop goes out: a camera left moving turns to its limit.
        var stopped = stop(CancellationToken.None);
        try
        {
            await moved;
        }
        catch (Exception)
        {
            await StopAfterFailedMoveAsync(stopped);
            throw;
        }
        await stopped;
        ct.ThrowIfCancellationRequested();
    }

    // Measured from the move sent to the stop sent; the stop does not wait for the move's answer, only a refusal stops it sooner.
    private async Task<TimeSpan> StopWhenReleasedAsync(
        long sentAt, Task moved, Func<CancellationToken, Task> stop, Task released, SemaphoreSlim running)
    {
        try
        {
            var due = Task.WhenAll(released, Task.Delay(MinimumHold, time));
            await Task.WhenAny(due, moved);
            if (moved.IsCompletedSuccessfully) await due;

            var elapsed = time.GetElapsedTime(sentAt);
            var stopped = stop(CancellationToken.None);
            // The move's error reaches the press that started it, not the release.
            await moved.ConfigureAwait(ConfigureAwaitOptions.SuppressThrowing);
            if (!moved.IsCompletedSuccessfully)
            {
                await StopAfterFailedMoveAsync(stopped);
                return TimeSpan.Zero;
            }
            await stopped;
            return elapsed;
        }
        finally
        {
            running.Release();
        }
    }

    // A move that throws before its first await still reaches the stop, which frees the camera.
    private static Task Send(Func<CancellationToken, Task> move, CancellationToken ct)
    {
        try
        {
            return move(ct);
        }
        catch (Exception ex)
        {
            return Task.FromException(ex);
        }
    }

    // The move's error is the one raised; the stop's is only logged.
    private async Task StopAfterFailedMoveAsync(Task stopped)
    {
        try { await stopped; }
        catch (Exception ex) { logger.LogWarning(ex, "PTZ stop after a failed move did not go through either."); }
    }
}
