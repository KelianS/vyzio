# ADR-09: PTZ positions are resolved above the protocol, the camera holding its own when it can

## Context

A camera with a motorised head is driven directly, whatever its vendor (principle 6), and its
positions serve twice: the slots the user saves and recalls (UC-PTZ-02, PTZ-05) and the privacy
parking (ADR-10). Cameras differ on what they offer:

- some store presets themselves and land on the same framing every time, over ONVIF or over DVRIP;
  an ICSee keeps presets over DVRIP although it reports no such capability and its vendor app offers
  none, so a new unit holds none ([ICSee sheet](../hardware/icsee.md));
- others cannot store a preset at all, a V380 among them ([V380 Pro sheet](../hardware/v380-pro.md)),
  yet the product promises positions on every camera with a head (PTZ-10);
- a move is either discrete, a packet the camera bounds itself, or continuous, kept up until a stop
  reaches it, so the distance covered depends on time, not on a count of commands;
- a position may also be saved or deleted in the vendor app, outside Vyzio (PTZ-06).

A position mechanism that each protocol implements on its own fails silently on the protocol that
does not, and a failure the user cannot see contradicts principle 4. Frigate exposes no way for
Vyzio to drive a camera's head.

## Decision

Vyzio resolves a camera's positions once, in the application layer, on two tiers chosen by what the
camera proved; the protocol providers only move the camera.

- **First tier, native presets**: when the camera can store presets, it is the only source of truth.
  Vyzio reads its presets whenever it needs to know which slots are held, orders it to store one on a
  save and to go there on a recall, and keeps no record that a slot is held. Slot N is the camera's
  preset N, never the position in its list nor its name; presets beyond the slots are ignored and
  never cleared. A held slot is what the camera answers now: when it does not answer, the positions
  could not be read, and are never taken as missing (PTZ-08).
- **How the first tier is detected, by protocol**: over ONVIF by a read, the camera's PTZ node having
  room for at least one preset, even with none saved; over DVRIP by storing a preset on a spare slot
  outside those Vyzio uses, checking the camera lists it, then clearing it whatever happened. That
  write, undone within the probe, is the one write a probe makes. Either way the detection weighs only
  on the tier, never on whether PTZ is verified (ADR-04).
- **Second tier, positions Vyzio manages**: a position is a motion time per axis from the up-left
  mechanical limit, so every protocol counts in one unit. Vyzio holds the current position in memory,
  establishes it by a calibration, one continuous move up-left for the whole range plus a margin, and
  stores each saved slot. A recall is one continuous move per axis for the difference, with no homing
  before it. The time covering the whole range is set per protocol, an estimate until measured.
- **A move is one continuous move per press**, short or held: the interface asks for the start on the
  press, signals the hold while it lasts, and asks for the stop on the release. Vyzio times the move on
  its own clock and adds that time to the position. A move lasts a minimum time so that a short press
  still turns the camera; a hold whose signal stops is stopped by the server; a timed move runs its
  duration whatever the network. One place paces every move and runs one at a time per camera. A
  discrete protocol repeats its packet until the stop, each counting a nominal time.
- **A provider supplies motion primitives only**: start and stop a move on a session it opens before
  the move, the native preset calls, and the time of its whole range. The application holds that
  session for the whole move, so no connection or login happens inside one. The provider contract
  carries no default implementation: a protocol cannot be added without saying how it moves. One
  ONVIF provider serves every brand that speaks ONVIF PTZ.
- **A failure is raised and named**, refused or unreachable (ADR-04), never swallowed: a move that
  failed stops the camera and leaves the position unknown, so the next save asks for a calibration; a
  move skipped because another was running moves nothing; a recall cut short answers an error.
- **A saved position counts only on the tier it was saved on.** After a probe changes the tier, the
  other tier's positions read as not saved; they are kept, and count again if that tier comes back.
- **Vyzio keeps what the camera cannot**: each slot's thumbnail, as a file in the data directory, and
  the free labels of the slots the user names. The client asks for the thumbnail once the camera has
  arrived after a move it requested, from the engine's latest frame. When a slot reads empty, its
  thumbnail and label are dropped.

## Consequences

- ✅ Every camera with a head saves and recalls positions through one path, the preset buttons and
  the privacy parking alike, and a new protocol cannot claim a calibration it never did.
- ✅ A position saved or deleted in the vendor app shows on its slot, with the vendor app's numbering.
- ✅ A held joystick moves without stutter, and a recall is two moves whatever the distance.
- ⚠️ Reading the slots costs a round trip to the camera, and the panel and the privacy screen depend
  on the camera answering.
- ⚠️ A managed position is lost when the API restarts and needs a calibration (PTZ-09); how
  precisely it is found again is measured per camera, never guaranteed.
- ⚠️ A stop names no press: on quick successive presses, a late stop ends the next press after its
  minimum time.
- ⚠️ Over ONVIF, the move and the stop of a short press are two requests the wire does not order; a
  camera handling the stop first would turn to its limit.
- ⚠️ Each DVRIP PTZ probe writes and clears one preset; a failed cleanup leaves at most one preset on
  a slot Vyzio never uses.
- ⚠️ An ONVIF camera that reports room for presets yet refuses the slot numbers cannot save its
  positions; each save says why.
- ⚠️ A position moved in the vendor app keeps its old thumbnail until the next recall refreshes it.

## Options rejected

| Option | Why rejected |
| --- | --- |
| Homing and position tracking as optional provider methods doing nothing by default | A protocol that skips them claims a calibration it never did, as the DVRIP one did. |
| Implementing homing in each provider, or in a shared base class | A copy per protocol, and an opt-in that falls back to silence; when to home and what a position is are product rules. |
| Swallowing a failed step | A move the camera never took would still count, and a calibration that never reached the camera would still succeed. |
| A position counted in fixed steps, a hold as chained steps | Tried: a session per step made a held joystick stutter. |
| A step length set by the network round trip, or derived from the requested speed | The same count covers a different distance each time, so a saved position is never found again. |
| A tap told apart from a hold by its duration | Tried: a tap often did not move the motor, and a press just past the threshold moved far. |
| Homing before each recall | A full sweep to the limit on every recall, for an error that stays within the replay. |
| Absolute positioning as its own tier | No camera Vyzio drives is confirmed to report and reach an absolute pan and tilt; it would slot between the two tiers without reopening this decision. |
| Vyzio's own record of the native positions, or a one-time import | Two copies that drift as soon as the vendor app saves or deletes a preset. |
| Mapping slots to presets by list order, or by name | The order shifts when a preset is deleted; names are free text, and absent over DVRIP. |
| A non-empty preset list as the native criterion | A camera that can store presets but holds none, every new ICSee among them, would count its first positions and lose them once one exists. |
| A capability flag as the DVRIP criterion | An ICSee answers not supported, although it keeps presets. |
| Storing then clearing a spare preset over ONVIF too | ONVIF says by a read whether the camera can keep presets; a proof stays a read where one exists (ADR-04). |
| One adapter per brand for ONVIF PTZ | The same ONVIF logic copied per brand. |
| Driving the head through Frigate | Frigate exposes no such control to Vyzio. |
| Thumbnails in the database, or in the browser | The database grows with images; the browser loses them and shares them with no other device. |
