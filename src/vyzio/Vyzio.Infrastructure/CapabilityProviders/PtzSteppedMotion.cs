using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.CapabilityProviders;

// A move whose packet the camera bounds itself (V380, ONVIF RelativeMove): each packet counts StepLength of motion (ADR-60).
internal abstract class PtzSteppedMotion(PtzMoveRunner runner, Camera camera, TimeSpan stepLength, ILogger logger) : IPtzMotion
{
    // Packets a long move may lose once one went through, and still reach the limit (ADR-59 d).
    private const int LostMargin = 2;

    protected Camera Camera { get; } = camera;

    private Task? _held;
    private int _heldTaken;
    private CameraCommandException? _heldFailure;

    protected abstract Task StepAsync(PtzDirection direction, int speed, CancellationToken ct);

    public async Task<TimeSpan> MoveForAsync(PtzDirection direction, int speed, TimeSpan duration, CancellationToken ct = default)
    {
        var count = Math.Max(1, (int)Math.Round(duration / stepLength));
        var taken = 0;
        var lost = 0;
        for (var i = 0; i < count; i++)
        {
            try
            {
                if (await runner.RunAsync(Camera, t => StepAsync(direction, speed, t), ct)) taken++;
                else if (++lost > LostMargin) break;
            }
            catch (CameraCommandException ex) when (taken > 0 && ++lost <= LostMargin)
            {
                logger.LogWarning(ex, "PTZ packet {Packet}/{Total} lost for {Camera}.", i + 1, count, Camera.DisplayName);
            }
        }
        return taken * stepLength;
    }

    // The first packet goes out here, so a refusal reaches the press; the next ones repeat until the stop.
    public async Task<bool> StartAsync(PtzDirection direction, int speed, Task released, CancellationToken ct = default)
    {
        if (!await runner.RunAsync(Camera, t => StepAsync(direction, speed, t), ct)) return false;
        _heldTaken = 1;
        _heldFailure = null;
        _held = RepeatAsync(direction, speed, released);
        return true;
    }

    public async Task<TimeSpan> StoppedAsync()
    {
        if (Interlocked.Exchange(ref _held, null) is not { } held) return TimeSpan.Zero;
        await held;
        if (_heldFailure is { } failure) throw failure;
        return _heldTaken * stepLength;
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;

    // A packet is never cut short by the release: it would leave the count one off.
    private async Task RepeatAsync(PtzDirection direction, int speed, Task released)
    {
        await Task.Yield();
        try
        {
            while (!released.IsCompleted)
                if (await runner.RunAsync(Camera, t => StepAsync(direction, speed, t), CancellationToken.None))
                    _heldTaken++;
        }
        catch (CameraCommandException ex)
        {
            _heldFailure = ex;
        }
    }
}
