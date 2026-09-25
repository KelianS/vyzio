# ADR-57: Privacy parking goes to the Parking slot, and back to Surveillance

> Status: Accepted
>
> Amends [ADR-21](0021-ptz-parking-and-a-generic-onvif-adapter-a-layered-privacy-mode-strategy.md) on
> the parking sequence (a continuous move to the mechanical stop on, `GotoPreset 1` off),
> [ADR-24](0024-protocol-layer-separated-from-capability-layer-onvifclient-supportedprotocol-privacystrategy.md)
> on the preset parking calls (`PtzGoToPresetAsync(presetId: 1)`, straight to the provider), and
> [ADR-25](0025-ptz-position-management-native-presets-branch-a-vs-vyzio-managed-positions-branch-b.md)
> on its consequence that privacy stays wired on preset 1.

## Context

ADR-25 reserves two slots: preset 1 **Surveillance** and preset 2 **Parking**, the destination of the
`ptz_parking` strategy. SPECS 9.3 names them the same way, and so does the dashboard. The code sent
privacy parking to preset 1, as ADR-21 and ADR-24 had written before ADR-25, and ADR-25's own
consequences still say so. A camera parked on its Surveillance slot keeps looking at the room.

Parking also called the PTZ provider directly. On a camera without native presets, the provider's
`GotoPreset` is a no-op (ADR-25's context), and the positions Vyzio keeps for that camera (branch B)
were never read: a V380 set to `ptz_parking` did not move at all.

Nothing brought the camera back when privacy ended. While parking and surveillance shared a slot this
did not show; once parking has its own slot, recording would resume facing the wall. SPECS 9.3 already
asks for the return ("afin que Vyzio sache toujours où la ramener après le mode vie privée").

## Decision

**a) Privacy on moves the camera to slot 2, Parking; privacy off moves it back to slot 1,
Surveillance.** Both moves take the same path as any move to a saved position, native presets on the
camera or positions kept by Vyzio (ADR-25 branches A and B). There is one way to reach a saved
position, used by the preset buttons and by privacy alike.

**b) Both moves are best effort** (ADR-20). Recording stops whether or not the camera reaches its
Parking position, and resumes whether or not it comes back to Surveillance. A move that fails is
logged; telling the user belongs to #143. The strict rule of ADR-20 for switching off (nothing changes
while the lens stays shut) holds for the hardware cut only: a camera left turned away still films
nothing of the room, so resuming recording hides nothing.

**c) The `ptz_parking` strategy requires both positions saved, Surveillance and Parking.** The API
refuses to select it for a camera missing either (`parking_positions_missing`), and the dashboard says
what to do first. Without Parking the camera would not turn away; without Surveillance it would stay
turned away when privacy ends, and recording would resume on the wall. A position counts as saved
when Vyzio holds its row: saving a preset records the row on both branches, the native token included.
A position saved in the vendor app is not known yet (#142).

## Options rejected

- **Fall back to the mechanical stop when no Parking position is saved.** ADR-21's original sequence,
  and what the README promised. Rejected: the stop can still see part of the room, so the strategy
  would claim more than it guarantees, and SPECS 9.3 defines parking as the Parking slot.
- **Keep the current strategy choice and let an unsaved position fail silently.** Rejected: a
  strategy that does nothing on the camera, with only a log line, is an opaque state (principle 4).
- **Require the Parking position alone.** Rejected: the return would then depend on a position nobody
  was asked to save.
- **Make the return move strict, like switching the hardware cut off.** Rejected: it would keep a
  camera out of surveillance because it failed to turn, although turned away it films nothing.

## Consequences

- Cameras already set to `ptz_parking` without both positions keep their strategy; the dashboard
  tells them which step is missing, the missing move is logged, and #143 will show it at the moment it
  happens.
- Switching privacy on or off waits for the camera's move, which takes seconds on a camera whose
  positions Vyzio keeps (homing, then steps). In a batch the cameras move one after another.
- No thumbnail is taken for either move: thumbnails are captured by the client after a move it asked
  for (ADR-26), and none is wanted while privacy is on.
