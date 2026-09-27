# ADR-59: PTZ positions are resolved above the protocol, providers only move

> Status: Accepted, the unit of a position (points a) 3 and b), counting steps), the provider primitives (point c), how long a move lasts (point e) and, for a continuous move, the lost-step margin (point d) superseded by [ADR-60](0060-ptz-positions-are-counted-in-motion-time-on-a-session-held-for-each-move.md)
>
> Supersedes [ADR-25](0025-ptz-position-management-native-presets-branch-a-vs-vyzio-managed-positions-branch-b.md)
> on where homing and position tracking live. Its reserved slots, the `ptz_presets` table and the
> routing on `supports_native_presets` stay.

## Context

ADR-25 routes a camera's positions on what the probe confirmed, never on the protocol, and calls
the positions Vyzio manages (branch B) the universal fallback. It then put homing and the virtual
position on the PTZ provider interface, as optional methods with a default that does nothing. Only
the V380 provider implemented them.

An ICSee camera whose PTZ is bound to DVRIP (#87) shows what that costs. Its probe never confirms
native presets, so it takes branch B; homing hits the empty default and returns; the API answers
204 and the screen says the camera is calibrated, although it never moved. The position stays
unknown, so every save is refused as not calibrated. Any protocol added later would fail the same
way, silently (principle 4).

The V380 homing had the same flaw on a smaller scale: a step the camera did not take was logged
and skipped, and homing ended on "position (0, 0)" even when not one step had reached the camera.

## Options compared

1. **Implement homing and tracking in the DVRIP provider too.** Rejected: a second copy of the
   V380 code, and the next protocol repeats the gap, since the empty default stays.
2. **A shared base class for step-based providers.** Rejected: when to home, how far, what a
   position is and when a step counts are product rules, not transport; and it stays opt-in, a
   provider that does not inherit falls back to silence again.
3. **Resolve positions once in the application layer; providers only supply motion primitives.**
   Chosen.

## Decision

**a) A camera's positions resolve in this order**, decided by what the probe confirmed:

1. **native presets** stored in the camera, when the probe confirms them (ADR-25 branch A);
2. **absolute positioning**, when the camera reports and reaches an absolute pan and tilt. This
   tier is **recorded, not implemented**: no camera Vyzio drives today is confirmed to support it.
   It will take its place between the two others without reopening this decision; until then a
   camera without native presets goes to the third tier;
3. **positions Vyzio manages**: homing to the up-left mechanical limit, then counting steps
   (ADR-25 branch B).

**b) The third tier is written once, above the providers**, in the application layer: the current
position of each camera (in memory, re-established by homing after a restart), homing,
counting every step taken, from the joystick as much as from a replay, saving a position and going
back to it. No provider holds a position.

**c) A provider supplies motion primitives only**: one step in a direction, which says whether the
camera took it; how many steps cover its whole mechanical range from anywhere, which is how far
homing goes when the position is unknown; and the native preset calls, used on the first tier
only. The provider interface carries **no default implementation**: a protocol cannot be added
without saying how it steps.

**d) A step counts only when the camera took it.** A camera failure is raised and named, refused
or unreachable (ADR-56), never swallowed. Homing fails with that error at the first step the
camera refuses or does not answer while none has gone through yet, and as soon as it has lost more
steps than its margin covers: the camera may not have reached its limit, so the calibration answers
the error, never a success. A step skipped because another move was still running does not move
the position, counts as lost during homing, and makes a move to a saved position answer an error
rather than claim it arrived.

**e) What a step is stays each protocol's own**: a discrete packet on the V380; a relative move, or
a short move then stop, over ONVIF; a move then stop over DVRIP, whose length depends on the round
trip to the camera. How repeatable a DVRIP step is, and so how precisely a saved position is found
again, is measured on the hardware.

**f) The DVRIP probe does not look for native presets.** ADR-25 names a DVRIP equivalent to the
ONVIF preset list; whether an ICSee unit keeps and recalls presets over DVRIP is unconfirmed on the
hardware, so DVRIP cameras take the third tier until it is.

## Options rejected

- **Homing and tracking as optional provider methods, doing nothing by default** (ADR-25).
  Rejected: a protocol that does not implement them claims a calibration it never did, as the
  DVRIP one did.
- **Keep swallowing a failed step, as the V380 and DVRIP providers did.** Rejected: a step the
  camera did not take would still be counted, and a homing that never reached the camera would
  still end on a known position.

## Consequences

- DVRIP cameras, ONVIF cameras without native presets and Tapo cameras calibrate, save and recall
  their positions through the same path as the V380. Their full-range step counts are estimates
  until measured on each camera. The Tapo provider does not yet name its failures refused or
  unreachable, so a Tapo camera that fails one step ends its homing.
- The V380 moves as before: same packet per step, same homing length and margin.
- A step a V380 or DVRIP camera refuses or does not answer now reaches the user, as it already
  did over ONVIF.
- ADR-57 holds: privacy parking reaches its slots through the same path as the preset buttons.
