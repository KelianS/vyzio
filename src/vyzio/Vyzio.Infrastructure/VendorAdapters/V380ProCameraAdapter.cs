using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.VendorAdapters;

// V380 Pro cameras: RTSP via ceshi.ini SD card unlock.
// No hardware privacy cut (ONVIF SetVideoEncoderConfiguration blocked by firmware, see investigations/v380_onvif_privacy.md).
// PTZ is fully functional via ONVIF ContinuousMove/Stop/SetPreset/GotoPreset on port 8899.
internal sealed class V380ProCameraAdapter(OnvifPtzClient ptz, ILogger<V380ProCameraAdapter> logger) : IVendorCameraAdapter
{
    public string VendorFamily => "v380_pro";

    public Task<bool> SupportsPrivacyModeAsync(Camera camera, CancellationToken ct = default)
    {
        logger.LogDebug("V380 PRO: no hardware privacy cut for {Camera}.", camera.DisplayName);
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

    public async Task<(float Pan, float Tilt)?> GetPtzPositionAsync(Camera camera, CancellationToken ct = default)
        => await ptz.GetPtzPositionAsync(camera, ct);

    // V380 ignores velocity magnitude, Timeout, and all advanced PTZ commands (RelativeMove,
    // GetStatus, SetPreset, GotoPreset — all HTTP 400). Only ContinuousMove + Stop work.
    // Step control: server-side delay between Move and Stop gives a deterministic amplitude.
    // At ~120°/s measured speed: speed=50 → 80ms ≈ 10°.
    public async Task PtzStepAsync(Camera camera, PtzDirection direction, int speed, CancellationToken ct = default)
    {
        var (pan, tilt) = DirectionToSign(direction);
        var token = await ptz.GetFirstProfileTokenAsync(camera, ct);
        await ptz.ContinuousMoveAsync(camera, token, pan, tilt, ct);
        var stepMs = Math.Clamp(speed * 2, 40, 200);
        await Task.Delay(stepMs, ct);
        await ptz.StopAsync(camera, token, ct);
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
    // V380 ignores velocity magnitude — only sign matters for direction.
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
