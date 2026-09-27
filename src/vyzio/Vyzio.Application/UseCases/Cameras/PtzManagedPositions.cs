using System.Collections.Concurrent;
using System.Globalization;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

// The positions Vyzio keeps for a camera without native presets, whatever its protocol (ADR-59).
public sealed class PtzManagedPositions(ILogger<PtzManagedPositions> logger)
{
    // Extra steps past the known position, and as many steps as homing may lose and still reach the limit.
    private const int HomingMargin = 2;
    private const int ReplaySpeed = 50;

    private readonly ConcurrentDictionary<string, (int X, int Y)> _positions = new();

    // Steps from the up-left limit, or null while the camera has not been homed since the service started.
    public (int X, int Y)? Current(string cameraId)
        => _positions.TryGetValue(cameraId, out var position) ? position : null;

    // A step counts only when the camera took it (ADR-59).
    public async Task<bool> StepAsync(
        Camera camera, CameraCapabilityBinding binding, IPtzCapabilityProvider provider,
        PtzDirection direction, int speed, CancellationToken ct)
    {
        var taken = await provider.PtzStepAsync(camera, binding, direction, speed, ct);
        if (taken && _positions.TryGetValue(camera.Id, out _))
        {
            var (dx, dy) = Delta(direction);
            _positions.AddOrUpdate(camera.Id, (dx, dy), (_, old) => (old.X + dx, old.Y + dy));
        }
        return taken;
    }

    // Drives the camera to its up-left limit, which becomes (0, 0); throws when it may not have got there (ADR-59).
    public async Task HomeAsync(
        Camera camera, CameraCapabilityBinding binding, IPtzCapabilityProvider provider, CancellationToken ct)
    {
        var known = Current(camera.Id);
        var steps = known is { } position
            ? Math.Max(Math.Max(position.X, position.Y), 0) + HomingMargin
            : provider.FullRangeSteps;

        logger.LogInformation("PTZ homing started for {Camera}: {Steps} steps up-left, position was {Position}.",
            camera.DisplayName, steps, known?.ToString() ?? "unknown");

        var taken = 0;
        var lost = 0;
        for (var i = 0; i < steps; i++)
        {
            try
            {
                if (await provider.PtzStepAsync(camera, binding, PtzDirection.UpLeft, ReplaySpeed, ct)) taken++;
                else if (++lost > HomingMargin) break;
            }
            catch (CameraCommandException ex) when (taken > 0 && ++lost <= HomingMargin)
            {
                logger.LogWarning(ex, "PTZ homing step {Step}/{Total} lost for {Camera}.", i + 1, steps, camera.DisplayName);
            }
        }

        if (taken == 0 || lost > HomingMargin)
            throw new CameraCommandRefusedException(string.Create(CultureInfo.InvariantCulture,
                $"PTZ homing over {provider.Protocol}: the camera took {taken} of the {steps} steps toward its limit."));

        _positions[camera.Id] = (0, 0);
        logger.LogInformation("PTZ homing complete for {Camera}: {Taken}/{Steps} steps taken, position reset to (0, 0).",
            camera.DisplayName, taken, steps);
    }

    // Homes first when the position is unknown, then steps across, then down; throws when it stopped short.
    public async Task GoToAsync(
        Camera camera, CameraCapabilityBinding binding, IPtzCapabilityProvider provider,
        int targetX, int targetY, CancellationToken ct)
    {
        if (Current(camera.Id) is null)
            await HomeAsync(camera, binding, provider, ct);

        var (x, y) = Current(camera.Id) ?? (0, 0);
        var dx = targetX - x;
        var dy = targetY - y;

        var across = dx > 0 ? PtzDirection.Right : PtzDirection.Left;
        var down = dy > 0 ? PtzDirection.Down : PtzDirection.Up;
        var skipped = 0;
        for (var i = 0; i < Math.Abs(dx); i++)
            if (!await StepAsync(camera, binding, provider, across, ReplaySpeed, ct)) skipped++;
        for (var i = 0; i < Math.Abs(dy); i++)
            if (!await StepAsync(camera, binding, provider, down, ReplaySpeed, ct)) skipped++;

        if (skipped > 0)
            throw new CameraCommandRefusedException(string.Create(CultureInfo.InvariantCulture,
                $"PTZ go-to over {provider.Protocol} stopped {skipped} steps short: another move was running."));
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
