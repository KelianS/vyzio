# TAD: the DVRIP client and its PTZ

> How Vyzio drives a camera over DVRIP (Xiongmai "Sofia": ICSee, Annke, Sannce, Zosi...). The *why*
> behind the choices is in
> [ADR-29](../adr/0029-dvrip-a-shared-dvripclient-image-settings-and-ptz-move-stop.md) (one shared client),
> [ADR-60](../adr/0060-ptz-positions-are-counted-in-motion-time-on-a-session-held-for-each-move.md)
> (a session held for each move),
> [ADR-59](../adr/0059-ptz-positions-resolved-above-the-protocol-providers-only-move.md) (positions in
> tiers, native presets first),
> [ADR-25](../adr/0025-ptz-position-management-native-presets-branch-a-vs-vyzio-managed-positions-branch-b.md)
> (routing on `supports_native_presets`) and [ADR-64](../adr/0064-dvrip-native-presets-detected-by-storing-then-clearing-a-spare-slot.md) (native presets
> detected by storing, then clearing, a spare slot). How the camera is reached, its port and its account, is in
> [`camera-connection.md`](camera-connection.md).
> Home of the code: `src/vyzio/Vyzio.Infrastructure/VendorAdapters/DvripClient.cs`, `DvripSession.cs`
> and `Vyzio.Infrastructure/CapabilityProviders/DvripPtzProvider.cs`.

## Role

Speak DVRIP to a camera that may speak nothing else: the binary header, the Sofia login and the JSON
commands live in `DvripClient`; what a command means for PTZ lives in `DvripPtzProvider`. The frame
layout and the command codes are in the code, next to the hardware check each one carries.

## Sessions

`DvripClient.OpenSessionAsync` connects and logs in within 5 s, and hands back a `DvripSession`: one
logged-in connection that carries as many commands as needed, sent in order, their answers matched
in order. A command waits 5 s for its answer; silence within that wait counts as taken (ADR-56). A
session the camera dropped is reopened before the next command, never within a move (ADR-60 h).

## The PTZ probe

The protocol check has already logged in with the DVRIP account; a login proves no capability
([ADR-66](../adr/0066-a-capability-is-proven-by-a-read-or-confirmed-by-the-user-after-a-try.md)). The
probe opens a session and asks whether the camera keeps presets of its own, without moving it:

1. Read the stored presets, `Uart.PTZPreset.[0]` through `ConfigGet`. An answer that lacks the list key
   ends the probe here, since no slot is known to be free; an empty or null list means none is stored.
2. Pick the spare slot: the highest id from 255 down to 5 that is not already stored. Slots 1 to 4
   are the ones Vyzio uses (ADR-25, `PtzPreset`), and a preset already on the camera is never
   overwritten.
3. `SetPreset` on that slot, then read the list again: the slot must be listed.
4. `ClearPreset` on that slot, even when step 3 failed.

When the slot is listed, the probe records `supports_native_presets: true` on the binding, the
positions take the first tier, and the stored preset is the PTZ proof (`Proven`). Any other outcome (a
refusal, silence, an unreadable list, a slot missing from it) records `false`, the positions stay with
Vyzio (third tier), and the PTZ capability is `Unprovable`, left for the user to confirm. A session that
does not open fails the check with its reason. Why a probe may store a preset, and the options rejected, are in
[ADR-64](../adr/0064-dvrip-native-presets-detected-by-storing-then-clearing-a-spare-slot.md).
A failed cleanup is logged and leaves at most one preset on the spare slot.

## Positions on the native tier

Saving a position is `SetPreset` on its slot, recalling it is `GotoPreset` on it, each on a session of
its own: the camera moves by itself, so no motion time is counted and no calibration exists
(`calibrated` stays true).

## Known camera behaviours

Measured on an ICSee unit (2026-09-27).

| Behaviour | Effect | Where it is handled |
|---|---|---|
| `SetPreset` and `GotoPreset` answer `Ret` 100; a recall lands on the same framing every time, three presets recall distinctly in any order | Native presets are exact | The probe above; the native tier |
| `Uart.PTZPreset.[0]` lists the stored presets as `[{"Id": n}, ...]`; a new preset appears right after `SetPreset`, `ClearPreset` removes it | The list proves a preset was kept | Probe steps 1, 3 and 4 |
| At least twelve presets are kept at once, on ids up to 255 | Room for a spare slot above the four Vyzio uses | Probe step 2 |
| `Ability.PTZ` and `SystemFunction` answer `Ret` 607 (not supported) | No capability flag to read | Detection by storing a preset instead |
| The vendor app offers no preset feature | The capability is only visible through the protocol | The probe above |
