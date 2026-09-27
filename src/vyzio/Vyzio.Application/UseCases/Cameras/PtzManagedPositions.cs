using System.Collections.Concurrent;
using System.Globalization;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

// The positions Vyzio keeps for a camera without native presets, whatever its protocol, in motion time (ADR-59, ADR-60).
public sealed class PtzManagedPositions(TimeProvider time, ILogger<PtzManagedPositions> logger)
{
    // A tap moves this long, whatever the protocol and the network (ADR-60).
    public static readonly TimeSpan TapDuration = TimeSpan.FromMilliseconds(100);

    // Moved past the known position, or past the full range, so that a calibration reaches the limit.
    public static readonly TimeSpan HomingMargin = TimeSpan.FromMilliseconds(200);

    // A held move stops by itself when the interface has not signalled it for this long (ADR-60).
    public static readonly TimeSpan HoldTimeout = TimeSpan.FromSeconds(3);

    private const int ReplaySpeed = 50;

    private readonly ConcurrentDictionary<string, (int X, int Y)> _positions = new();
    private readonly ConcurrentDictionary<string, Hold> _holds = new();

    // Milliseconds of motion right and down from the up-left limit, or null while the camera has not been homed since the service started.
    public (int X, int Y)? Current(string cameraId)
        => _positions.TryGetValue(cameraId, out var position) ? position : null;

    // A timed move of TapDuration on a session of its own; it counts only when the camera took it (ADR-60).
    public async Task TapAsync(
        Camera camera, CameraCapabilityBinding binding, IPtzCapabilityProvider provider,
        PtzDirection direction, int speed, CancellationToken ct)
    {
        await using var motion = await provider.OpenMotionAsync(camera, binding, ct);
        Add(camera.Id, direction, await MoveAsync(camera, () => motion.MoveForAsync(direction, speed, TapDuration, ct)));
    }

    // Starts a move held until StopHoldAsync, or until the interface stops signalling it (ADR-60).
    public async Task StartHoldAsync(
        Camera camera, CameraCapabilityBinding binding, IPtzCapabilityProvider provider,
        PtzDirection direction, int speed, CancellationToken ct)
    {
        await StopHoldAsync(camera.Id);

        var motion = await provider.OpenMotionAsync(camera, binding, ct);
        var started = false;
        try
        {
            started = await MoveAsync(camera, () => motion.StartAsync(direction, speed, ct));
        }
        finally
        {
            if (!started) await motion.DisposeAsync();
        }
        if (!started) return;

        var hold = new Hold(camera, direction, motion);
        hold.Watchdog = time.CreateTimer(_ => _ = StopUnsignalledAsync(hold), null, HoldTimeout, Timeout.InfiniteTimeSpan);
        // A concurrent press registered first: this one ends at once rather than leave the camera moving unheld.
        if (!_holds.TryAdd(camera.Id, hold)) await EndAsync(hold);
    }

    // False when no move of this camera is held any more, stopped by its release or by the watchdog.
    public bool SignalHold(string cameraId)
    {
        if (!_holds.TryGetValue(cameraId, out var hold)) return false;
        hold.Watchdog?.Change(HoldTimeout, Timeout.InfiniteTimeSpan);
        return true;
    }

    // Stops the held move and adds how long it moved to the position; nothing to do when none is held.
    public async Task StopHoldAsync(string cameraId)
    {
        if (_holds.TryRemove(cameraId, out var hold))
            await EndAsync(hold);
    }

    // Drives the camera to its up-left limit, which becomes (0, 0); throws when it may not have got there (ADR-59).
    public async Task HomeAsync(
        Camera camera, CameraCapabilityBinding binding, IPtzCapabilityProvider provider, CancellationToken ct)
    {
        await using var motion = await provider.OpenMotionAsync(camera, binding, ct);
        await HomeAsync(camera, provider, motion, ct);
    }

    // Homes first when the position is unknown, then moves across, then down; throws when it stopped short.
    public async Task GoToAsync(
        Camera camera, CameraCapabilityBinding binding, IPtzCapabilityProvider provider,
        int targetX, int targetY, CancellationToken ct)
    {
        if (Current(camera.Id) == (targetX, targetY)) return;

        // One session for the whole recall, homing included: no login between two moves (ADR-60).
        await using var motion = await provider.OpenMotionAsync(camera, binding, ct);
        if (Current(camera.Id) is null)
            await HomeAsync(camera, provider, motion, ct);

        var (x, y) = Current(camera.Id) ?? (0, 0);
        await MoveAxisAsync(camera, provider, motion, targetX > x ? PtzDirection.Right : PtzDirection.Left, Math.Abs(targetX - x), ct);
        await MoveAxisAsync(camera, provider, motion, targetY > y ? PtzDirection.Down : PtzDirection.Up, Math.Abs(targetY - y), ct);
    }

    private async Task MoveAxisAsync(
        Camera camera, IPtzCapabilityProvider provider, IPtzMotion motion, PtzDirection direction, int milliseconds, CancellationToken ct)
    {
        if (milliseconds == 0) return;

        var asked = TimeSpan.FromMilliseconds(milliseconds);
        var moved = await MoveAsync(camera, () => motion.MoveForAsync(direction, ReplaySpeed, asked, ct));
        Add(camera.Id, direction, moved);
        if (moved < asked)
            throw new CameraCommandRefusedException(string.Create(CultureInfo.InvariantCulture,
                $"PTZ go-to over {provider.Protocol} stopped {(asked - moved).TotalMilliseconds:0} ms short: another move was running."));
    }

    private async Task HomeAsync(Camera camera, IPtzCapabilityProvider provider, IPtzMotion motion, CancellationToken ct)
    {
        var known = Current(camera.Id);
        var duration = (known is { } position
            ? TimeSpan.FromMilliseconds(Math.Max(Math.Max(position.X, position.Y), 0))
            : provider.FullRange) + HomingMargin;

        logger.LogInformation("PTZ homing started for {Camera}: {Duration} ms up-left, position was {Position}.",
            camera.DisplayName, duration.TotalMilliseconds, known?.ToString() ?? "unknown");

        // Short of the margin, the camera may not have reached its limit: no calibration is claimed (ADR-59 d).
        var moved = await MoveAsync(camera, () => motion.MoveForAsync(PtzDirection.UpLeft, ReplaySpeed, duration, ct));
        if (moved < duration - HomingMargin)
            throw new CameraCommandRefusedException(string.Create(CultureInfo.InvariantCulture,
                $"PTZ homing over {provider.Protocol}: the camera moved {moved.TotalMilliseconds:0} of the {duration.TotalMilliseconds:0} ms toward its limit."));

        _positions[camera.Id] = (0, 0);
        logger.LogInformation("PTZ homing complete for {Camera}: {Moved} ms moved, position reset to (0, 0).",
            camera.DisplayName, moved.TotalMilliseconds);
    }

    // A move that failed may have covered part of its time, or not stopped: the position is no longer known (ADR-60).
    private async Task<T> MoveAsync<T>(Camera camera, Func<Task<T>> move)
    {
        try
        {
            return await move();
        }
        catch (Exception ex) when (ex is CameraCommandException or OperationCanceledException)
        {
            if (_positions.TryRemove(camera.Id, out _))
                logger.LogWarning("PTZ position of {Camera} lost: a move did not go through, calibrate again.", camera.DisplayName);
            throw;
        }
    }

    private async Task EndAsync(Hold hold)
    {
        hold.Watchdog?.Dispose();
        try
        {
            Add(hold.Camera.Id, hold.Direction, await MoveAsync(hold.Camera, hold.Motion.StopAsync));
        }
        finally
        {
            await hold.Motion.DisposeAsync();
        }
    }

    // A tab closed or a network cut mid-hold must not leave the camera turning to its limit (ADR-60).
    private async Task StopUnsignalledAsync(Hold hold)
    {
        if (!_holds.TryRemove(new KeyValuePair<string, Hold>(hold.Camera.Id, hold))) return;
        logger.LogWarning("PTZ hold of {Camera} stopped: the interface stopped signalling it.", hold.Camera.DisplayName);
        try
        {
            await EndAsync(hold);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "PTZ stop of an unsignalled hold did not go through on {Camera}.", hold.Camera.DisplayName);
        }
    }

    // Only a known position moves: an unknown one waits for a calibration.
    private void Add(string cameraId, PtzDirection direction, TimeSpan moved)
    {
        if (moved <= TimeSpan.Zero || !_positions.ContainsKey(cameraId)) return;
        var ms = (int)Math.Round(moved.TotalMilliseconds);
        var (dx, dy) = Delta(direction);
        _positions.AddOrUpdate(cameraId, (dx * ms, dy * ms), (_, old) => (old.X + dx * ms, old.Y + dy * ms));
    }

    private sealed class Hold(Camera camera, PtzDirection direction, IPtzMotion motion)
    {
        public Camera Camera { get; } = camera;
        public PtzDirection Direction { get; } = direction;
        public IPtzMotion Motion { get; } = motion;
        public ITimer? Watchdog { get; set; }
    }

#pragma warning disable format // Aligned as a table so each row reads against the others.
    private static (int Dx, int Dy) Delta(PtzDirection direction) => direction switch
    {
        PtzDirection.Up        => ( 0, -1),
        PtzDirection.Down      => ( 0,  1),
        PtzDirection.Left      => (-1,  0),
        PtzDirection.Right     => ( 1,  0),
        PtzDirection.UpLeft    => (-1, -1),
        PtzDirection.UpRight   => ( 1, -1),
        PtzDirection.DownLeft  => (-1,  1),
        PtzDirection.DownRight => ( 1,  1),
        _                      => ( 0,  0),
    };
#pragma warning restore format
}
