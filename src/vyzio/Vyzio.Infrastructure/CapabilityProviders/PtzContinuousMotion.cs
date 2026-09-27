using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.CapabilityProviders;

// A move the camera keeps up until a stop reaches it (DVRIP, ONVIF ContinuousMove, Tapo): its length is timed (ADR-60).
internal abstract class PtzContinuousMotion(PtzMoveRunner runner, Camera camera) : IPtzMotion
{
    private PtzHeldMove? _held;

    protected Camera Camera { get; } = camera;

    protected abstract Task MoveAsync(PtzDirection direction, int speed, CancellationToken ct);

    protected abstract Task StopMoveAsync(CancellationToken ct);

    // Reopens what the camera dropped since the last move, before the next one and never within it (ADR-60).
    protected virtual Task PrepareAsync(CancellationToken ct) => Task.CompletedTask;

    public async Task<TimeSpan> MoveForAsync(PtzDirection direction, int speed, TimeSpan duration, CancellationToken ct = default)
    {
        await PrepareAsync(ct);
        return await runner.RunTimedAsync(Camera, t => MoveAsync(direction, speed, t), StopMoveAsync, duration, ct)
            ? duration
            : TimeSpan.Zero;
    }

    public async Task<bool> StartAsync(PtzDirection direction, int speed, CancellationToken ct = default)
    {
        await PrepareAsync(ct);
        _held = await runner.HoldAsync(Camera, t => MoveAsync(direction, speed, t), StopMoveAsync, ct);
        return _held is not null;
    }

    public Task<TimeSpan> StopAsync()
        => Interlocked.Exchange(ref _held, null) is { } held ? held.StopAsync() : Task.FromResult(TimeSpan.Zero);

    public ValueTask DisposeAsync() => CloseAsync();

    protected virtual ValueTask CloseAsync() => ValueTask.CompletedTask;
}
