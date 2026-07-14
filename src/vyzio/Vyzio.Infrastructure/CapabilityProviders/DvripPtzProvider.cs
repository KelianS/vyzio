using System.Text.Json;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Infrastructure.CapabilityProviders;

// IPtzCapabilityProvider for the DVRIP protocol (Xiongmai/XMEye chipset: ICSee, Annke,
// Sannce, Zosi...). Delegates wire-level framing/login to DvripClient (shared with
// DvripImageSettingsProvider) — all PTZ feature logic (payload shape, direction mapping)
// lives here.
internal sealed class DvripPtzProvider(DvripClient dvrip, ILogger<DvripPtzProvider> logger) : IPtzCapabilityProvider
{
    private const int PtzCmd = 1400;

    public SupportedProtocol Protocol => SupportedProtocol.Dvrip;

    public async Task<bool> ProbeAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
        => await dvrip.TryLoginAsync(camera, ct);

    public async Task PtzMoveAsync(Camera camera, CameraCapabilityBinding binding, PtzDirection direction, int speed, CancellationToken ct = default)
    {
        var command = DirectionToCommand(direction);
        var step = Math.Clamp(speed / 12, 1, 8); // map 0-100 → 1-8
        await ExecutePtzAsync(camera, "Start", command, 65535, step, ct);
    }

    public async Task PtzStopAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
        => await ExecutePtzAsync(camera, "Stop", "DirectionUp", 65535, 0, ct);

    public async Task PtzGoToPresetAsync(Camera camera, CameraCapabilityBinding binding, int presetId, CancellationToken ct = default)
        => await ExecutePtzAsync(camera, "Start", "GotoPreset", presetId, 0, ct);

    public async Task PtzSavePresetAsync(Camera camera, CameraCapabilityBinding binding, int presetId, CancellationToken ct = default)
        => await ExecutePtzAsync(camera, "Start", "SetPreset", presetId, 0, ct);

    private async Task ExecutePtzAsync(Camera camera, string action, string command, int preset, int step, CancellationToken ct)
    {
        try
        {
            var response = await dvrip.ExecuteAsync(camera, PtzCmd,
                sessionId => BuildPtzPayload(sessionId, action, command, preset, step), ct);

            if (response is null)
                logger.LogWarning("DVRIP login failed for {Camera} — PTZ skipped.", camera.DisplayName);
            else if (!DvripClient.IsRetOk(response))
                logger.LogWarning("DVRIP PTZ {Action}/{Command} returned non-OK for {Camera}: {Resp}.", action, command, camera.DisplayName, response);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "DVRIP PTZ error for {Camera}.", camera.DisplayName);
        }
    }

    private static string BuildPtzPayload(string sessionId, string action, string command, int preset, int step)
    {
        return JsonSerializer.Serialize(new
        {
            Name = "OPPTZControl",
            SessionID = sessionId,
            OPPTZControl = new
            {
                Action = action,
                Command = command,
                Parameter = new
                {
                    AUX = new { Number = 0, Status = "On" },
                    Channel = 0,
                    MenuOpts = "Enter",
                    POINT = new { bottom = 0, left = 0, right = 0, top = 0 },
                    Pattern = "SetBegin",
                    Preset = preset,
                    Step = step,
                    Tour = 0
                }
            }
        });
    }

    // SofiaHash is exposed on DvripClient (shared) — kept here as a thin forward for existing
    // callers/tests that reference DvripPtzProvider.SofiaHash.
    internal static string SofiaHash(string password) => DvripClient.SofiaHash(password);

    internal static string DirectionToCommand(PtzDirection direction) => direction switch
    {
        PtzDirection.Up        => "DirectionUp",
        PtzDirection.Down      => "DirectionDown",
        PtzDirection.Left      => "DirectionLeft",
        PtzDirection.Right     => "DirectionRight",
        PtzDirection.UpLeft    => "DirectionLeftUp",
        PtzDirection.UpRight   => "DirectionRightUp",
        PtzDirection.DownLeft  => "DirectionLeftDown",
        PtzDirection.DownRight => "DirectionRightDown",
        _                      => "DirectionUp"
    };
}
