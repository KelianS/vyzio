using System.Collections.Concurrent;
using System.Xml.Linq;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Infrastructure.CapabilityProviders;

internal record PtzCapabilities(bool SupportsRelativeMove)
{
    public static readonly PtzCapabilities Default = new(false);
}

// IPtzCapabilityProvider for the ONVIF protocol — covers Hikvision, Dahua, Reolink, Axis,
// V380, and any ONVIF-compliant PTZ camera (ADR-22). Delegates to OnvifClient for the
// raw SOAP transport; all feature logic (caching, step serialization) lives here.
internal sealed class OnvifPtzProvider(OnvifClient onvif, ILogger<OnvifPtzProvider> logger) : IPtzCapabilityProvider
{
    public SupportedProtocol Protocol => SupportedProtocol.Onvif;

    // Profile tokens are stable for the lifetime of a camera — cache per camera ID to avoid
    // a GetProfiles round-trip before every PTZ command (main source of step overshoot).
    private readonly ConcurrentDictionary<string, string> _profileCache = new();
    private readonly ConcurrentDictionary<string, string> _ptzConfigCache = new();
    private readonly ConcurrentDictionary<string, PtzCapabilities> _capabilitiesCache = new();

    // Serializes step commands per camera: prevents concurrent ContinuousMove/Stop sequences.
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _stepLocks = new();

    public async Task<bool> ProbeAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
    {
        try
        {
            var token = await GetProfileTokenAsync(camera, ct);
            if (string.IsNullOrWhiteSpace(token)) return false;
            await GetPtzCapabilitiesAsync(camera, ct);
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
        var token = await GetProfileTokenAsync(camera, ct);
        await onvif.ContinuousMoveAsync(camera, token, pan, tilt, ct);
    }

    public async Task PtzStopAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
    {
        var token = await GetProfileTokenAsync(camera, ct);
        await onvif.StopAsync(camera, token, ct);
    }

    public async Task PtzGoToPresetAsync(Camera camera, CameraCapabilityBinding binding, int presetId, CancellationToken ct = default)
    {
        var token = await GetProfileTokenAsync(camera, ct);
        await onvif.GotoPresetAsync(camera, token, presetId, ct);
    }

    public async Task PtzSavePresetAsync(Camera camera, CameraCapabilityBinding binding, int presetId, CancellationToken ct = default)
    {
        var token = await GetProfileTokenAsync(camera, ct);
        await onvif.SetPresetAsync(camera, token, presetId, ct);
    }

    public async Task PtzStepAsync(Camera camera, CameraCapabilityBinding binding, PtzDirection direction, int speed, CancellationToken ct = default)
    {
        var token = await GetProfileTokenAsync(camera, ct);
        var caps = await GetPtzCapabilitiesAsync(camera, ct);

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
                await onvif.RelativeMoveAsync(camera, token, pan, tilt, ct);
            }
            else
            {
                var (pan, tilt) = DirectionToSign(direction);
                var stepMs = Math.Clamp(speed * 2, 40, 200);
                await onvif.ContinuousMoveAsync(camera, token, pan, tilt, ct);
                try { await Task.Delay(stepMs, ct); }
                finally { await onvif.StopAsync(camera, token, ct); }
            }
        }
        finally
        {
            stepLock.Release();
        }
    }

    public async Task<(float Pan, float Tilt)?> GetPtzPositionAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
    {
        var token = await GetProfileTokenAsync(camera, ct);
        return await onvif.GetStatusAsync(camera, token, ct);
    }

    private async Task<string> GetProfileTokenAsync(Camera camera, CancellationToken ct)
    {
        if (_profileCache.TryGetValue(camera.Id, out var cached))
            return cached;

        var (profileToken, ptzConfigToken) = await onvif.GetFirstProfileAsync(camera, ct);
        _profileCache[camera.Id] = profileToken;
        _ptzConfigCache[camera.Id] = ptzConfigToken;
        return profileToken;
    }

    private async Task<PtzCapabilities> GetPtzCapabilitiesAsync(Camera camera, CancellationToken ct)
    {
        if (_capabilitiesCache.TryGetValue(camera.Id, out var cached))
            return cached;

        await GetProfileTokenAsync(camera, ct);
        _ptzConfigCache.TryGetValue(camera.Id, out var configToken);
        configToken ??= "ptz_config_0";

        var xml = await onvif.GetPtzConfigurationOptionsAsync(camera, configToken, ct);

        PtzCapabilities caps;
        if (xml is null)
        {
            caps = PtzCapabilities.Default;
        }
        else
        {
            try
            {
                var doc = XDocument.Parse(xml);
                var supportsRelative = doc.Descendants()
                    .Any(e => e.Name.LocalName == "RelativePanTiltTranslationSpace");
                caps = new PtzCapabilities(supportsRelative);
            }
            catch { caps = PtzCapabilities.Default; }
        }

        _capabilitiesCache[camera.Id] = caps;
        logger.LogDebug("ONVIF PTZ capabilities for {Host}: RelativeMove={Rel}.", camera.Host, caps.SupportsRelativeMove);
        return caps;
    }

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
