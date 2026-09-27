using System.Collections.Concurrent;
using System.Xml;
using System.Xml.Linq;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Infrastructure.CapabilityProviders;

internal record PtzCapabilities(bool SupportsRelativeMove)
{
    public static readonly PtzCapabilities Default = new(false);
}

// PTZ over ONVIF for any compliant camera (ADR-22): SOAP through OnvifClient, pacing through PtzMoveRunner.
internal sealed class OnvifPtzProvider(OnvifClient onvif, PtzMoveRunner runner, ILogger<OnvifPtzProvider> logger) : IPtzCapabilityProvider
{
    public SupportedProtocol Protocol => SupportedProtocol.Onvif;

    // 80 relative moves at replay speed cover the normalized [-1, 1] range, the rest is margin; an estimate for a continuous move (ADR-60).
    public TimeSpan FullRange => 90 * RelativeMoveLength;

    // The motion time a relative move counts, so that both kinds of move share one unit (ADR-60).
    private static readonly TimeSpan RelativeMoveLength = TimeSpan.FromMilliseconds(100);

    // Profile tokens are stable for the lifetime of a camera — cache per camera ID to avoid
    // a GetProfiles round-trip before every PTZ command (main source of step overshoot).
    private readonly ConcurrentDictionary<string, string> _profileCache = new();
    private readonly ConcurrentDictionary<string, string?> _ptzConfigCache = new();
    private readonly ConcurrentDictionary<string, PtzCapabilities> _capabilitiesCache = new();

    public async Task<bool> ProbeAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
    {
        try
        {
            var token = await GetProfileTokenAsync(camera, ct);

            // Answering ONVIF is not doing PTZ over it: without a PTZ description, the cascade moves on (ADR-28).
            if (await ReadPtzCapabilitiesAsync(camera, ct) is null)
            {
                logger.LogDebug("ONVIF PTZ probe for {Camera}: the camera describes no PTZ configuration.", camera.DisplayName);
                return false;
            }

            // Detect native preset support (ADR-25 Branch A/B routing).
            var presetsCount = await onvif.GetPresetsCountAsync(camera, token, ct);
            var supportsNativePresets = presetsCount > 0;
            NativePresetsFlag.Record(binding, supportsNativePresets);
            logger.LogDebug("ONVIF PTZ probe for {Camera}: {Count} presets found, SupportsNativePresets={Supported}.",
                camera.DisplayName, presetsCount, supportsNativePresets);

            return true;
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "ONVIF PTZ probe failed for {Camera}.", camera.DisplayName);
            return false;
        }
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

    // The profile and its PTZ options are read here, before the move, so that no move waits on them (ADR-60).
    public async Task<IPtzMotion> OpenMotionAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
    {
        var token = await GetProfileTokenAsync(camera, ct);
        return (await GetPtzCapabilitiesAsync(camera, ct)).SupportsRelativeMove
            ? new RelativeMotion(onvif, runner, camera, token, logger)
            : new ContinuousMotion(onvif, runner, camera, token);
    }

    // Nothing to hold between moves: every ONVIF command carries its own credentials.
    private sealed class RelativeMotion(OnvifClient onvif, PtzMoveRunner runner, Camera camera, string token, ILogger logger)
        : PtzSteppedMotion(runner, camera, RelativeMoveLength, logger)
    {
        protected override Task StepAsync(PtzDirection direction, int speed, CancellationToken ct)
        {
            var (x, y) = DirectionToStep(direction, speed);
            return onvif.RelativeMoveAsync(Camera, token, x, y, ct);
        }
    }

    // A continuous move at full speed whatever the requested one, so that a replay covers what a hold did (ADR-60).
    private sealed class ContinuousMotion(OnvifClient onvif, PtzMoveRunner runner, Camera camera, string token)
        : PtzContinuousMotion(runner, camera)
    {
        protected override Task MoveAsync(PtzDirection direction, int speed, CancellationToken ct)
        {
            var (pan, tilt) = DirectionToSign(direction);
            return onvif.ContinuousMoveAsync(Camera, token, pan, tilt, ct);
        }

        protected override Task StopMoveAsync(CancellationToken ct) => onvif.StopAsync(Camera, token, ct);
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

    // A camera the user bound by hand still gets its commands tried, with the move-plus-stop fallback (ADR-28).
    private async Task<PtzCapabilities> GetPtzCapabilitiesAsync(Camera camera, CancellationToken ct)
        => await ReadPtzCapabilitiesAsync(camera, ct) ?? PtzCapabilities.Default;

    // Null when the camera describes no PTZ configuration; only a real description is cached.
    private async Task<PtzCapabilities?> ReadPtzCapabilitiesAsync(Camera camera, CancellationToken ct)
    {
        if (_capabilitiesCache.TryGetValue(camera.Id, out var cached))
            return cached;

        await GetProfileTokenAsync(camera, ct);
        if (!_ptzConfigCache.TryGetValue(camera.Id, out var configToken) || configToken is null)
            return null;

        var caps = ParsePtzCapabilities(await onvif.GetPtzConfigurationOptionsAsync(camera, configToken, ct));
        if (caps is null)
            return null;

        _capabilitiesCache[camera.Id] = caps;
        logger.LogDebug("ONVIF PTZ capabilities for {Host}: RelativeMove={Rel}.", camera.Host, caps.SupportsRelativeMove);
        return caps;
    }

    private static PtzCapabilities? ParsePtzCapabilities(string? xml)
    {
        if (xml is null)
            return null;

        XDocument doc;
        try { doc = XDocument.Parse(xml); }
        catch (XmlException) { return null; }

        var elements = doc.Descendants().ToList();
        if (!elements.Any(e => e.Name.LocalName == "PTZConfigurationOptions"))
            return null;

        return new PtzCapabilities(elements.Any(e => e.Name.LocalName == "RelativePanTiltTranslationSpace"));
    }

#pragma warning disable format // Aligned as a table so each row reads against the others.
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
#pragma warning restore format
}
