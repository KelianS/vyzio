using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Infrastructure.CapabilityProviders;

// IPtzCapabilityProvider for the DVRIP protocol (Xiongmai/XMEye chipset: ICSee, Annke,
// Sannce, Zosi...). Delegates wire-level framing/login to DvripClient (shared with
// DvripImageSettingsProvider) — all PTZ feature logic (payload shape, direction mapping)
// lives here.
internal sealed class DvripPtzProvider(DvripClient dvrip, PtzMoveRunner runner, ILogger<DvripPtzProvider> logger) : IPtzCapabilityProvider
{
    private const int PtzCmd = 1400;
    // The stop is DirectionUp with Preset=-1 whatever was moving, as python-dvr and dbuezas/icsee-ptz send it.
    private const string StopCommand = "DirectionUp";
    private const int StopStep = 5;
    private const string PresetList = "Uart.PTZPreset.[0]";
    // Slots 1 to 4 are Vyzio's; an ICSee keeps presets on ids up to 255 (TAD dvrip).
    private const int FirstSpareSlot = 5;
    private const int LastSlot = 255;

    public SupportedProtocol Protocol => SupportedProtocol.Dvrip;

    // Estimate, unmeasured on the hardware (ADR-60).
    public TimeSpan FullRange => TimeSpan.FromSeconds(15);

    public async Task<bool> ProbeAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
    {
        DvripSession session;
        try
        {
            session = await dvrip.OpenSessionAsync(camera, ct);
        }
        catch (CameraCommandException ex)
        {
            logger.LogDebug(ex, "DVRIP PTZ probe failed for {Camera}.", camera.DisplayName);
            return false;
        }

        await using (session)
            NativePresetsFlag.Record(binding, await DetectNativePresetsAsync(session, camera, ct));
        return true;
    }

    // Stores a preset on a spare slot and looks for it in the camera's list, never moving it; Ability.PTZ answers 607 on an ICSee (TAD dvrip).
    private async Task<bool> DetectNativePresetsAsync(DvripSession session, Camera camera, CancellationToken ct)
    {
        int slot;
        try
        {
            var stored = await ReadStoredPresetsAsync(session, ct);
            slot = stored is null ? 0 : SpareSlot(stored);
            if (slot == 0) return false;
        }
        catch (CameraCommandException ex)
        {
            logger.LogDebug(ex, "DVRIP preset list unreadable on {Camera}.", camera.DisplayName);
            return false;
        }

        try
        {
            await ExecutePtzAsync(session, camera, "SetPreset", slot, step: 0, ct);
            var listed = (await ReadStoredPresetsAsync(session, ct))?.Contains(slot) == true;
            logger.LogDebug("DVRIP PTZ probe for {Camera}: preset {Slot} listed after SetPreset: {Listed}.", camera.DisplayName, slot, listed);
            return listed;
        }
        catch (CameraCommandException)
        {
            return false;
        }
        finally
        {
            await ClearProbeSlotAsync(session, camera, slot);
        }
    }

    // The highest slot above Vyzio's four that holds no preset yet, 0 when none is free.
    private static int SpareSlot(IReadOnlySet<int> stored)
    {
        for (var slot = LastSlot; slot >= FirstSpareSlot; slot--)
            if (!stored.Contains(slot)) return slot;
        return 0;
    }

    // Not cancelled with the probe, so the spare slot is cleared even when the probe is abandoned.
    private async Task ClearProbeSlotAsync(DvripSession session, Camera camera, int slot)
    {
        try
        {
            await ExecutePtzAsync(session, camera, "ClearPreset", slot, step: 0, CancellationToken.None);
        }
        catch (CameraCommandException)
        {
            // Already logged; at most one preset stays on the spare slot.
        }
    }

    // The ids of the presets the camera keeps, null when it does not say (ADR-56 silence, refusal, unreadable list).
    private static async Task<IReadOnlySet<int>?> ReadStoredPresetsAsync(DvripSession session, CancellationToken ct)
    {
        var answer = await session.ExecuteAsync(
            DvripClient.ConfigGetCmd, sessionId => JsonSerializer.Serialize(new { Name = PresetList, SessionID = sessionId }), ct);
        if (!DvripClient.IsRetOk(answer)) return null;
        try
        {
            return JsonNode.Parse(answer!)?[PresetList] is JsonArray list
                ? list.Select(preset => preset?["Id"]?.GetValue<int>()).OfType<int>().ToHashSet()
                : new HashSet<int>();
        }
        catch (Exception ex) when (ex is JsonException or InvalidOperationException or FormatException)
        {
            return null;
        }
    }

    public async Task PtzGoToPresetAsync(Camera camera, CameraCapabilityBinding binding, int presetId, CancellationToken ct = default)
        => await ExecutePtzAsync(camera, "GotoPreset", presetId, step: 0, ct);

    public async Task PtzSavePresetAsync(Camera camera, CameraCapabilityBinding binding, int presetId, CancellationToken ct = default)
        => await ExecutePtzAsync(camera, "SetPreset", presetId, step: 0, ct);

    // The login happens here, before the move, and the session is held until the move ends (ADR-60).
    public async Task<IPtzMotion> OpenMotionAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
        => new Motion(this, runner, camera, await OpenSessionAsync(camera, ct));

    public Task<(float Pan, float Tilt)?> GetPtzPositionAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
        => Task.FromResult<(float Pan, float Tilt)?>(null);

    // A command the camera did not take is raised, named, never swallowed (ADR-56, ADR-59).
    private async Task ExecutePtzAsync(Camera camera, string command, int preset, int step, CancellationToken ct)
    {
        await using var session = await OpenSessionAsync(camera, ct);
        await ExecutePtzAsync(session, camera, command, preset, step, ct);
    }

    private async Task ExecutePtzAsync(DvripSession session, Camera camera, string command, int preset, int step, CancellationToken ct)
    {
        try
        {
            var response = await session.ExecuteAsync(PtzCmd, sessionId => BuildPtzPayload(sessionId, command, preset, step), ct);
            if (response is not null && !DvripClient.IsRetOk(response))
                throw new CameraCommandRefusedException($"DVRIP PTZ {command} refused by {camera.Host} (Ret={DvripClient.ReadRet(response)?.ToString(CultureInfo.InvariantCulture) ?? "?"}).");
        }
        catch (CameraCommandException ex)
        {
            logger.LogWarning(ex, "DVRIP PTZ {Command} did not go through on {Camera}.", command, camera.DisplayName);
            throw;
        }
    }

    private async Task<DvripSession> OpenSessionAsync(Camera camera, CancellationToken ct)
    {
        try
        {
            return await dvrip.OpenSessionAsync(camera, ct);
        }
        catch (CameraCommandException ex)
        {
            logger.LogWarning(ex, "DVRIP PTZ login did not go through on {Camera}.", camera.DisplayName);
            throw;
        }
    }

    private static int SpeedToStep(int speed) => Math.Clamp(speed / 12, 1, 8);

    // A move then a stop on one logged-in session (ADR-29, ADR-60).
    private sealed class Motion(DvripPtzProvider provider, PtzMoveRunner runner, Camera camera, DvripSession session)
        : PtzContinuousMotion(runner, camera)
    {
        private DvripSession _session = session;

        protected override Task MoveAsync(PtzDirection direction, int speed, CancellationToken ct)
            => provider.ExecutePtzAsync(_session, Camera, DirectionToCommand(direction), preset: 0, SpeedToStep(speed), ct);

        protected override Task StopMoveAsync(CancellationToken ct)
            => provider.ExecutePtzAsync(_session, Camera, StopCommand, preset: -1, StopStep, ct);

        protected override async Task PrepareAsync(CancellationToken ct)
        {
            if (_session.IsOpen) return;
            await _session.DisposeAsync();
            _session = await provider.OpenSessionAsync(Camera, ct);
        }

        protected override ValueTask CloseAsync() => _session.DisposeAsync();
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
#pragma warning disable format // Aligned as a table so each row reads against the others.
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
#pragma warning restore format
}
