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

    // Confirmed against dbuezas/icsee-ptz (a real, community-used Home Assistant integration
    // for this exact camera family, found via web search 2026-07-15) — its async_move():
    //   if cmd == "Stop": dvrip.ptz("DirectionUp", preset=-1)
    //   else:             dvrip.ptz(cmd, step=step, preset=preset)   # preset defaults to 0
    // Preset=-1 is the real stop sentinel — not a "0"/"65535" placeholder as previously assumed,
    // and not tied to the direction that was moving (Command is always "DirectionUp" for stop).
    // No "Action" field exists at all (matches python-dvr's ptz() exactly) — the field Vyzio
    // used to send was invented from an investigation note and never part of the real protocol.
    public async Task PtzMoveAsync(Camera camera, CameraCapabilityBinding binding, PtzDirection direction, int speed, CancellationToken ct = default)
    {
        var command = DirectionToCommand(direction);
        var step = Math.Clamp(speed / 12, 1, 8); // map 0-100 → 1-8
        await ExecutePtzAsync(camera, command, preset: 0, step, ct);
    }

    public async Task PtzStopAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
        => await ExecutePtzAsync(camera, "DirectionUp", preset: -1, step: 5, ct);

    public async Task PtzGoToPresetAsync(Camera camera, CameraCapabilityBinding binding, int presetId, CancellationToken ct = default)
        => await ExecutePtzAsync(camera, "GotoPreset", presetId, step: 0, ct);

    public async Task PtzSavePresetAsync(Camera camera, CameraCapabilityBinding binding, int presetId, CancellationToken ct = default)
        => await ExecutePtzAsync(camera, "SetPreset", presetId, step: 0, ct);

    private async Task ExecutePtzAsync(Camera camera, string command, int preset, int step, CancellationToken ct)
    {
        try
        {
            var response = await dvrip.ExecuteAsync(camera, PtzCmd,
                sessionId => BuildPtzPayload(sessionId, command, preset, step), ct);

            if (response is null)
                logger.LogWarning("DVRIP login failed for {Camera} — PTZ skipped.", camera.DisplayName);
            else if (!DvripClient.IsRetOk(response))
                logger.LogWarning("DVRIP PTZ {Command} returned non-OK for {Camera}: {Resp}.", command, camera.DisplayName, response);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "DVRIP PTZ error for {Camera}.", camera.DisplayName);
        }
    }

    // Matches python-dvr's DVRIPCam.ptz() payload exactly (confirmed both by reading its source
    // and by dbuezas/icsee-ptz's identical vendored copy, actively used in production) — no
    // "Action" field, no "POINT", "Pattern" is always "Start". Internal (not private): the
    // Preset=0 (move) vs Preset=-1 (stop) distinction is the single most important, easiest to
    // silently regress detail in this file — worth a direct unit test.
    internal static string BuildPtzPayload(string sessionId, string command, int preset, int step)
    {
        return JsonSerializer.Serialize(new
        {
            Name = "OPPTZControl",
            SessionID = sessionId,
            OPPTZControl = new
            {
                Command = command,
                Parameter = new
                {
                    AUX = new { Number = 0, Status = "On" },
                    Channel = 0,
                    MenuOpts = "Enter",
                    Pattern = "Start",
                    Preset = preset,
                    Step = step,
                    Tour = command.Contains("Tour") ? 1 : 0
                }
            }
        });
    }

    // SofiaHash is exposed on DvripClient (shared) — kept here as a thin forward for existing
    // callers/tests that reference DvripPtzProvider.SofiaHash.
    internal static string SofiaHash(string password) => DvripClient.SofiaHash(password);

    // Horizontal axis reported mirrored on real hardware (2026-07-15): pressing Left visibly
    // panned right and vice versa. Vertical axis was correct (pressing Down did move down).
    // Fix: swap the Left/Right DVRIP command names (and their diagonal combinations) rather
    // than the PtzDirection the UI sends — the mismatch is between Vyzio's direction and this
    // camera's motor wiring/mount, not the DVRIP command names themselves.
    internal static string DirectionToCommand(PtzDirection direction) => direction switch
    {
        PtzDirection.Up        => "DirectionUp",
        PtzDirection.Down      => "DirectionDown",
        PtzDirection.Left      => "DirectionRight",
        PtzDirection.Right     => "DirectionLeft",
        PtzDirection.UpLeft    => "DirectionRightUp",
        PtzDirection.UpRight   => "DirectionLeftUp",
        PtzDirection.DownLeft  => "DirectionRightDown",
        PtzDirection.DownRight => "DirectionLeftDown",
        _                      => "DirectionUp"
    };
}
