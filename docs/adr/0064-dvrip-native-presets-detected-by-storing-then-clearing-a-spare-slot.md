# ADR-64: DVRIP native presets are detected by storing, then clearing, a spare slot

> Status: Accepted, point b), on the login deciding whether PTZ is verified, amended by [ADR-66](0066-a-capability-is-proven-by-a-read-or-confirmed-by-the-user-after-a-try.md), its rejected option 1 standing over ONVIF by [ADR-69](0069-the-camera-is-the-only-source-of-truth-for-native-presets.md)
>
> Supersedes [ADR-59](0059-ptz-positions-resolved-above-the-protocol-providers-only-move.md) on its
> point f) (the DVRIP probe does not look for native presets) and, over DVRIP only,
> [ADR-25](0025-ptz-position-management-native-presets-branch-a-vs-vyzio-managed-positions-branch-b.md)
> on how native presets are detected (a non-empty preset list).

## Context

ADR-59 puts native presets first among the ways to reach a saved position, and left DVRIP cameras on
the positions Vyzio manages until the hardware showed whether an ICSee keeps and recalls presets over
DVRIP. Those positions are counted in motion time (ADR-60) and are never as exact as a position the
camera stores itself.

The hardware answered (#220): an ICSee stores a preset on `SetPreset`, lands on the same framing on
every `GotoPreset`, lists what it stores in `Uart.PTZPreset`, and removes a preset on `ClearPreset`.
The measurements are in the [ICSee sheet](../hardware/icsee.md). The vendor app offers no preset
feature, so a new camera holds none, and the camera reports no capability flag that says it could.

## Options compared

1. **A non-empty preset list**, as ADR-25 detects native presets.
2. **A capability flag**, `Ability.PTZ` or `SystemFunction`.
3. **Store a preset on a spare slot, check the list names it, then clear it.** Chosen.

## Decision

**a) The DVRIP PTZ probe confirms native presets by storing one**, on the session it opened to verify
the binding, without moving the camera: it stores a preset on a slot outside the four Vyzio uses and
not already taken, checks the camera then lists that slot, and clears it whatever happened before.
When the slot is listed, `supports_native_presets` is recorded and the camera's positions take the
first tier of ADR-59; any other outcome records its absence and they stay with Vyzio.

**b) This is the one write a probe may make**, and only because it is undone within the probe: it
adds nothing the camera keeps and weighs on the route of the positions, never on whether the PTZ
capability is verified, which the login alone decides, like the ONVIF preset count.

## Options rejected

- **A non-empty preset list** (option 1, ADR-25). Rejected for DVRIP: an ICSee holds no preset until
  one is stored, since its vendor app has none, so every camera would stay on the positions Vyzio
  manages. It stands over ONVIF.
- **A capability flag** (option 2). Rejected: an ICSee answers `Ret` 607 (not supported) to both,
  although it keeps presets.
- **Stay on the positions Vyzio manages** (ADR-59 f). Rejected: the hardware keeps exact presets, and
  a counted position only approaches them.

## Consequences

- An ICSee whose probe passes saves and recalls its positions through `SetPreset` and `GotoPreset`,
  with no calibration offered. A DVRIP camera whose probe fails calibrates, saves and recalls through
  the positions Vyzio manages, as ADR-59 describes.
- Each probe of a DVRIP PTZ binding stores and clears one preset on the camera. A cleanup that fails
  leaves at most one preset on a slot Vyzio never uses.
- A saved position counts only on the tier it was saved on: the camera holds the native ones, Vyzio
  the counted ones, and neither tier can reach the other's. After a probe changes the tier, the
  positions saved on the other one read as not saved, so a recall or a privacy parking says the
  position is missing rather than claim a move, and the user saves them again. They are kept, and
  count again if the tier comes back, unless the slot was saved again in the meantime.
