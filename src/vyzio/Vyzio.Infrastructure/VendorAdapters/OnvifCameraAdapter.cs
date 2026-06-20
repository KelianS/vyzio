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

    // Serializes step commands per camera: prevents concurrent ContinuousMove/Stop sequences
    // that would overwhelm budget cameras (V380 only handles one ONVIF connection at a time).
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, System.Threading.SemaphoreSlim> _stepLocks = new();

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

    public async Task<(float Pan, float Tilt)?> GetPtzPositionAsync(Camera camera, CancellationToken ct = default)
        => await ptz.GetPtzPositionAsync(camera, ct);

    public async Task PtzStepAsync(Camera camera, PtzDirection direction, int speed, CancellationToken ct = default)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        logger.LogInformation("PTZ [{Camera}] step {Dir} speed={Speed} — start", camera.DisplayName, direction, speed);

        var token = await ptz.GetFirstProfileTokenAsync(camera, ct);
        logger.LogInformation("PTZ [{Camera}] +{Ms}ms — profile token ready", camera.DisplayName, sw.ElapsedMilliseconds);

        var caps = await ptz.GetPtzCapabilitiesAsync(camera, ct);
        logger.LogInformation("PTZ [{Camera}] +{Ms}ms — caps ready (RelativeMove={Rel})", camera.DisplayName, sw.ElapsedMilliseconds, caps.SupportsRelativeMove);

        var stepLock = _stepLocks.GetOrAdd(camera.Id, _ => new SemaphoreSlim(1, 1));
        if (!await stepLock.WaitAsync(TimeSpan.FromMilliseconds(300), ct))
        {
            logger.LogInformation("PTZ [{Camera}] +{Ms}ms — skipped (previous step still in progress)", camera.DisplayName, sw.ElapsedMilliseconds);
            return;
        }
        logger.LogInformation("PTZ [{Camera}] +{Ms}ms — lock acquired", camera.DisplayName, sw.ElapsedMilliseconds);

        try
        {
            if (caps.SupportsRelativeMove)
            {
                var (pan, tilt) = DirectionToStep(direction, speed);
                logger.LogInformation("PTZ [{Camera}] +{Ms}ms — sending RelativeMove pan={Pan:F4} tilt={Tilt:F4}", camera.DisplayName, sw.ElapsedMilliseconds, pan, tilt);
                await ptz.RelativeMoveAsync(camera, token, pan, tilt);
                logger.LogInformation("PTZ [{Camera}] +{Ms}ms — RelativeMove done", camera.DisplayName, sw.ElapsedMilliseconds);
            }
            else
            {
                var (pan, tilt) = DirectionToSign(direction);
                var stepMs = Math.Clamp(speed * 2, 40, 200);
                logger.LogInformation("PTZ [{Camera}] +{Ms}ms — sending ContinuousMove delay={StepMs}ms", camera.DisplayName, sw.ElapsedMilliseconds, stepMs);
                await ptz.ContinuousMoveAsync(camera, token, pan, tilt);
                logger.LogInformation("PTZ [{Camera}] +{Ms}ms — ContinuousMove done, waiting delay", camera.DisplayName, sw.ElapsedMilliseconds);
                try
                {
                    await Task.Delay(stepMs, ct);
                }
                finally
                {
                    logger.LogInformation("PTZ [{Camera}] +{Ms}ms — sending Stop", camera.DisplayName, sw.ElapsedMilliseconds);
                    await ptz.StopAsync(camera, token);
                    logger.LogInformation("PTZ [{Camera}] +{Ms}ms — Stop done", camera.DisplayName, sw.ElapsedMilliseconds);
                }
            }
        }
        finally
        {
            stepLock.Release();
        }
    }

    public async Task PtzGoToPresetAsync(Camera camera, int presetId, CancellationToken ct = default)
    {
        var token = await ptz.GetFirstProfileTokenAsync(camera, ct);
        await ptz.GotoPresetAsync(camera, token, presetId);
    }

    public async Task PtzSavePresetAsync(Camera camera, int presetId, CancellationToken ct = default)
    {
        var token = await ptz.GetFirstProfileTokenAsync(camera, ct);
        await ptz.SetPresetAsync(camera, token, presetId);
    }

    // sign-only velocity for cameras that ignore magnitude (e.g. V380 Pro)
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
