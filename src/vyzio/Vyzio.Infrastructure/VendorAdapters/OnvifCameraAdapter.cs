using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.VendorAdapters;

// Generic ONVIF adapter for PTZ cameras detected at onboarding (vendorFamily = "onvif").
// Covers Hikvision, Dahua, Reolink, Axis, and any ONVIF-compliant PTZ camera.
// Hardware privacy is not implemented here — ONVIF VideoEncoder manipulation is blocked
// on most consumer firmware (see investigations/v380_onvif_privacy.md for context).
// PTZ parking is the privacy mechanism for this adapter.
internal sealed class OnvifCameraAdapter(OnvifPtzClient ptz, ILogger<OnvifCameraAdapter> logger) : IVendorCameraAdapter
{
    public string VendorFamily => "onvif";

    public Task<bool> SupportsPrivacyModeAsync(Camera camera, CancellationToken ct = default)
    {
        logger.LogDebug("ONVIF generic: no hardware privacy cut for {Camera}.", camera.DisplayName);
        return Task.FromResult(false);
    }

    public Task SetPrivacyModeAsync(Camera camera, bool active, CancellationToken ct = default)
        => Task.CompletedTask;

    public Task<bool> SupportsPtzAsync(Camera camera, CancellationToken ct = default)
        => Task.FromResult(true);

    public async Task PtzMoveAsync(Camera camera, PtzDirection direction, int speed, CancellationToken ct = default)
    {
        var (pan, tilt) = DirectionToVelocity(direction, speed);
        var token = await ptz.GetFirstProfileTokenAsync(camera, ct);
        await ptz.ContinuousMoveAsync(camera, token, pan, tilt, ct);
    }

    public async Task PtzStopAsync(Camera camera, CancellationToken ct = default)
    {
        var token = await ptz.GetFirstProfileTokenAsync(camera, ct);
        await ptz.StopAsync(camera, token, ct);
    }

    public async Task PtzStepAsync(Camera camera, PtzDirection direction, int speed, CancellationToken ct = default)
    {
        var (pan, tilt) = DirectionToStep(direction, speed);
        var token = await ptz.GetFirstProfileTokenAsync(camera, ct);
        await ptz.RelativeMoveAsync(camera, token, pan, tilt, ct);
    }

    public async Task PtzGoToPresetAsync(Camera camera, int presetId, CancellationToken ct = default)
    {
        var token = await ptz.GetFirstProfileTokenAsync(camera, ct);
        await ptz.GotoPresetAsync(camera, token, presetId, ct);
    }

    public async Task PtzSavePresetAsync(Camera camera, int presetId, CancellationToken ct = default)
    {
        var token = await ptz.GetFirstProfileTokenAsync(camera, ct);
        await ptz.SetPresetAsync(camera, token, presetId, ct);
    }

    // step = fraction of full pan/tilt range: speed=50 → 0.025 (≈4.5° on a 180° camera)
    private static (float pan, float tilt) DirectionToStep(PtzDirection direction, int speed)
    {
        var s = Math.Clamp(speed / 2000f, 0.01f, 0.08f);
        return direction switch
        {
            PtzDirection.Up        => (0f, s),
            PtzDirection.Down      => (0f, -s),
            PtzDirection.Left      => (-s, 0f),
            PtzDirection.Right     => (s, 0f),
            PtzDirection.UpLeft    => (-s, s),
            PtzDirection.UpRight   => (s, s),
            PtzDirection.DownLeft  => (-s, -s),
            PtzDirection.DownRight => (s, -s),
            _                      => (0f, 0f)
        };
    }

    private static (float pan, float tilt) DirectionToVelocity(PtzDirection direction, int speed)
    {
        var s = Math.Clamp(speed / 100f, 0.1f, 1f);
        return direction switch
        {
            PtzDirection.Up        => (0f, s),
            PtzDirection.Down      => (0f, -s),
            PtzDirection.Left      => (-s, 0f),
            PtzDirection.Right     => (s, 0f),
            PtzDirection.UpLeft    => (-s, s),
            PtzDirection.UpRight   => (s, s),
            PtzDirection.DownLeft  => (-s, -s),
            PtzDirection.DownRight => (s, -s),
            _                      => (0f, 0f)
        };
    }
}
