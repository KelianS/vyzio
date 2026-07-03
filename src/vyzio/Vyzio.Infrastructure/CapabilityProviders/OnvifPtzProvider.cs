using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Infrastructure.CapabilityProviders;

// IPtzCapabilityProvider for the ONVIF protocol — covers Hikvision, Dahua, Reolink, Axis,
// V380, and any ONVIF-compliant PTZ camera (ADR-22). Delegates to OnvifPtzClient for the
// actual SOAP logic (shared with OnvifCameraAdapter which is kept until Phase 3 removal).
internal sealed class OnvifPtzProvider(OnvifPtzClient ptz, ILogger<OnvifPtzProvider> logger) : IPtzCapabilityProvider
{
    public CapabilityProtocol Protocol => CapabilityProtocol.Onvif;

    // Serializes step commands per camera: prevents concurrent ContinuousMove/Stop sequences.
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _stepLocks = new();

    public async Task<bool> ProbeAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
    {
        try
        {
            var token = await ptz.GetFirstProfileTokenAsync(camera, ct);
            if (string.IsNullOrWhiteSpace(token)) return false;
            await ptz.GetPtzCapabilitiesAsync(camera, ct);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "ONVIF PTZ probe failed for {Camera}.", camera.DisplayName);
            return false;
        }
    }

    public async Task PtzMoveAsync(Camera camera, CameraCapabilityBinding binding, PtzDirection direction, int speed, CancellationToken ct = default)
    {
        var (pan, tilt) = DirectionToVelocity(direction, speed);
        var token = await ptz.GetFirstProfileTokenAsync(camera, ct);
        await ptz.ContinuousMoveAsync(camera, token, pan, tilt, ct);
    }

    public async Task PtzStopAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
    {
        var token = await ptz.GetFirstProfileTokenAsync(camera, ct);
        await ptz.StopAsync(camera, token, ct);
    }

    public async Task PtzGoToPresetAsync(Camera camera, CameraCapabilityBinding binding, int presetId, CancellationToken ct = default)
    {
        var token = await ptz.GetFirstProfileTokenAsync(camera, ct);
        await ptz.GotoPresetAsync(camera, token, presetId);
    }

    public async Task PtzSavePresetAsync(Camera camera, CameraCapabilityBinding binding, int presetId, CancellationToken ct = default)
    {
        var token = await ptz.GetFirstProfileTokenAsync(camera, ct);
        await ptz.SetPresetAsync(camera, token, presetId);
    }

    public async Task PtzStepAsync(Camera camera, CameraCapabilityBinding binding, PtzDirection direction, int speed, CancellationToken ct = default)
    {
        var token = await ptz.GetFirstProfileTokenAsync(camera, ct);
        var caps = await ptz.GetPtzCapabilitiesAsync(camera, ct);

        var stepLock = _stepLocks.GetOrAdd(camera.Id, _ => new SemaphoreSlim(1, 1));
        if (!await stepLock.WaitAsync(TimeSpan.FromMilliseconds(300), ct))
        {
            logger.LogDebug("ONVIF step skipped for {Camera}: previous step in progress.", camera.DisplayName);
            return;
        }

        try
        {
            if (caps.SupportsRelativeMove)
            {
                var (pan, tilt) = DirectionToStep(direction, speed);
                await ptz.RelativeMoveAsync(camera, token, pan, tilt);
            }
            else
            {
                var (pan, tilt) = DirectionToSign(direction);
                var stepMs = Math.Clamp(speed * 2, 40, 200);
                await ptz.ContinuousMoveAsync(camera, token, pan, tilt);
                try { await Task.Delay(stepMs, ct); }
                finally { await ptz.StopAsync(camera, token); }
            }
        }
        finally
        {
            stepLock.Release();
        }
    }

    public async Task<(float Pan, float Tilt)?> GetPtzPositionAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
        => await ptz.GetPtzPositionAsync(camera, ct);

    private static (float pan, float tilt) DirectionToVelocity(PtzDirection direction, int speed)
    {
        var s = Math.Clamp(speed / 100f, 0.1f, 1f);
        return direction switch
        {
            PtzDirection.Up        => (0f,   s),
            PtzDirection.Down      => (0f,  -s),
            PtzDirection.Left      => (-s,  0f),
            PtzDirection.Right     => (s,   0f),
            PtzDirection.UpLeft    => (-s,   s),
            PtzDirection.UpRight   => (s,    s),
            PtzDirection.DownLeft  => (-s,  -s),
            PtzDirection.DownRight => (s,   -s),
            _                      => (0f,  0f),
        };
    }

    private static (float pan, float tilt) DirectionToStep(PtzDirection direction, int speed)
    {
        var s = Math.Clamp(speed / 2000f, 0.01f, 0.08f);
        return direction switch
        {
            PtzDirection.Up        => (0f,   s),
            PtzDirection.Down      => (0f,  -s),
            PtzDirection.Left      => (-s,  0f),
            PtzDirection.Right     => (s,   0f),
            PtzDirection.UpLeft    => (-s,   s),
            PtzDirection.UpRight   => (s,    s),
            PtzDirection.DownLeft  => (-s,  -s),
            PtzDirection.DownRight => (s,   -s),
            _                      => (0f,  0f),
        };
    }

    private static (float pan, float tilt) DirectionToSign(PtzDirection direction) => direction switch
    {
        PtzDirection.Up        => (0f,  1f),
        PtzDirection.Down      => (0f, -1f),
        PtzDirection.Left      => (-1f, 0f),
        PtzDirection.Right     => (1f,  0f),
        PtzDirection.UpLeft    => (-1f, 1f),
        PtzDirection.UpRight   => (1f,  1f),
        PtzDirection.DownLeft  => (-1f,-1f),
        PtzDirection.DownRight => (1f, -1f),
        _                      => (0f,  0f),
    };
}
