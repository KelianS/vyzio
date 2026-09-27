# ADR-60: PTZ positions are counted in motion time, on a session held for each move

> Status: Accepted
>
> Supersedes [ADR-59](0059-ptz-positions-resolved-above-the-protocol-providers-only-move.md) on the
> unit of a position (points a) 3 and b), counting steps, and with it the unit of the `ptz_presets`
> columns ADR-25 defined), on the primitives a provider supplies (point c), one step at a time and a
> full range in steps), on how long a move that lasts until stopped runs (point e), and, for such a
> move, on the lost-step margin of point d). The rest of ADR-59 stands. Supersedes
> [ADR-29](0029-dvrip-a-shared-dvripclient-image-settings-and-ptz-move-stop.md) on the DVRIP move as a
> move then a stop (point e), each on a connection of its own (point a).

## Context

On the positions Vyzio manages (ADR-59, third tier), going back to a saved position replays the
difference from the known position. That only lands on the same framing twice if what is replayed
covers the same distance as what was recorded.

A move is either discrete, a packet whose movement the camera bounds itself (V380, an ONVIF
`RelativeMove`), or continuous, a move the camera keeps up until a stop reaches it: DVRIP, ONVIF
without `RelativeMove`, Tapo. On a continuous move, the distance covered is the time between the
move and the stop. The DVRIP and Tapo providers sent the stop as soon as the move had answered, and
opened a new connection with a login for each command: a step lasted one or two round trips plus a
login, and an ICSee recall (#219) went the right way and never landed twice on the same framing.

A held joystick must also move without a pause, whatever the protocol and the network: a held move
made of steps is only as smooth as the gap between two of them.

## Options compared

1. **Home before each recall.**
2. **Fixed-length steps, a hold made of chained steps, each on its own session.**
3. **Count a position in motion time, and move continuously for as long as needed, on a session held
   for the whole move.** Chosen.

## Decision

**a) A position is a motion time per axis**, in milliseconds from the up-left limit: how long the
camera has moved right, and down, since. A discrete move counts a fixed nominal time per packet, so
positions of every protocol are in the same unit and a saved position replays in the one it was
recorded in.

**b) A held joystick is one continuous move.** It starts on the press and stops on the release, on a
session opened at the start and held until the stop. Vyzio measures how long it moved on its own
timer, an injected `TimeProvider`, from the move sent to the stop sent, and adds that time to the
position. On a protocol whose move is discrete, the hold repeats its packet until the stop, each
counting its nominal time.

**c) A held move stops by itself.** The interface signals the hold for as long as the press lasts;
when the signal stops for a few seconds (tab closed, network cut), the server stops the camera and
counts the move as if released.

**d) A tap is a timed move of a fixed duration**, the same whatever the requested speed and the
network: the timer starts as the move goes out, and the stop goes out when it runs out, whether or
not the move has answered yet. One place in the infrastructure paces every timed move and runs one
move at a time per camera.

**e) A recall is one continuous move per axis** for the time of the difference, from the known
position, with no homing added before it. **A calibration is one continuous move up-left** for the
time that covers the whole range plus a margin, or for the known position plus that margin.

**f) The time that covers the whole range is set per protocol**, and stays an estimate until
measured on each camera, as ADR-59 says for its step counts.

**g) No connection and no login inside a continuous move.** A provider opens what a move needs
(connection, login, profile) before it, and the application holds it for the whole move: a hold, a
tap, a recall with the calibration it may start, a calibration. A session the camera dropped is
reopened before the next move, never within one. A discrete packet is bounded by the camera, so what
it opens per packet does not change the distance it covers.

**h) Errors are raised and named, as ADR-56 says.** A move the camera refuses is stopped at once; a
stop still goes out when the move failed; silence within the command wait counts as taken. A move
that failed may have covered part of its time, or not stopped: it leaves the position unknown, and the
next save asks for a calibration rather than record a wrong position. A move skipped because another
one was running moves nothing and keeps the position; a recall it cuts short answers an error rather
than claim it arrived, as ADR-59 d) says.

## Options rejected

- **Home before each recall** (option 1). Rejected by the owner: a full sweep to the limit on every
  recall, for an error that remains within the replay itself.
- **The move length set by the round trip to the camera** (ADR-59 e) for DVRIP). Rejected: the same
  count means a different distance on every network, and a saved position is never found again.
- **A step length derived from the requested speed** (the former ONVIF fallback). Rejected: a
  joystick move and a replay would not cover the same distance.
- **A position counted in steps of a fixed length, a hold as chained steps** (option 2). Tried on the
  ICSee: the steps were repeatable, but the interface chained one step request after another, each
  opening and closing its own session, and a login between two steps made a held joystick stutter.

## Consequences

- A held joystick moves continuously on DVRIP, ONVIF without `RelativeMove` and Tapo; a recall is two
  moves, whatever the distance. How precisely a saved position is found again is measured on the
  hardware.
- The interface drives a press in three calls, start, signal and stop, next to the single tap.
- A DVRIP move reuses one logged-in connection; its commands go out in order and their answers are
  matched in order.
- Over ONVIF and Tapo, the move and the stop of a tap are two HTTP requests the wire does not order:
  a camera that handled the stop first would turn to its limit. The hardware test checks it.
- The V380 moves as before: the same packet per tap, repeated while held, the same homing length and
  margin. It still opens its stream per packet.
- Positions saved before this change were counted in steps and are to be saved again.
