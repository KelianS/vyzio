# ADR-10: Privacy mode stacks what the camera can do on an engine stop that always happens

## Context

Privacy mode must really cut a camera: no recording, no detection, no notification (PRIV-01), and
the stream reachable neither from Vyzio nor from Frigate (PRIV-02), switched by hand or by a weekly
range (PRIV-03).

The cut can only be guaranteed at the source. A camera and any other device share the home router,
so Vyzio cannot intercept their traffic: a firewall on the hub filters only what crosses the hub. What
remains is the camera's firmware, which some cameras expose and most do not, or its power supply,
which needs equipment the user may not own. Short of a firmware cut, a camera with a motorised head
can at least turn away from the room (PRIV-12).

Whatever the camera does, it may fail to do it: a refused command, a camera that does not answer, a
position never saved. The user must still be protected, and the interface must say what the camera
actually did, never what the strategy promised (PRIV-04, PRIV-05).

## Decision

Privacy mode always stops the camera in the engine, and adds on top what the camera's strategy asks
of the camera itself; the engine stop never depends on the camera's answer.

- **The strategy is a per-camera enum of three values**: the software stop, the default; parking,
  which turns the head away; the hardware cut, which closes the lens through the camera's firmware
  (PRIV-10). There is no "none" value: every strategy says what the camera does on top of the software
  stop, which always happens (PRIV-11). A strategy is not a protocol: the camera's protocols and its
  privacy strategy are separate values (ADR-04).
- **The engine layer**: the camera is disabled in the generated configuration (ADR-02) and the engine
  is restarted at once, the one change that never waits for the explicit restart of ADR-15; the
  camera's open live views end at once (ADR-07). Once begun, a switch is applied to the end even if
  the caller hangs up. The state is persisted and survives a restart (PRIV-08).
- **The camera layer is asked first**, before the state changes, through the capability provider of
  the protocol the capability is bound to (ADR-04), never through a per-brand adapter. A strategy
  that acts on the camera needs its capability verified; an unverified one is recorded as a miss and
  privacy still applies.
- **Best effort, except a lens left shut**: switching on stops the engine whatever the camera answers,
  and parking resumes surveillance on switching off even if the camera does not come back. Switching
  the hardware cut off is strict: a lens that does not reopen leaves privacy on, so the interface never
  shows surveillance resumed on a shut lens.
- **What the camera did is persisted with the state**: the cut it confirmed, or why it did not follow,
  a position missing, a capability unverified, the camera failing, or an answer cut short. The
  interface reads that, not the strategy (PRIV-04, PRIV-05).
- **Parking goes to the Parking slot on, and back to the Surveillance slot off**, through the one path
  every move to a saved position takes (ADR-09). Choosing parking requires both positions saved, read
  from the camera on the native tier; without them the choice is refused. Choosing a strategy writes
  nothing to the engine.
- **A privacy range is a scheduled rule** of ADR-15. The source of the activation, by hand or by a
  range, is persisted with the state, so a range never undoes a manual act (PRIV-07).
- **A batch switches the cameras one after another, then restarts the engine once**, even when it
  stops half way, so every camera already saved stops recording.

## Consequences

- ✅ No camera is left unprotected by Vyzio: a failed cut or turn still stops recording, detection
  and notifications.
- ✅ The user reads the guarantee the camera actually gave, and the reason when it gave none.
- ✅ A new hardware cut is a capability provider for its protocol; the privacy flow does not change.
- ⚠️ On the software stop alone, the camera keeps streaming on the home network to whoever knows its
  address: Vyzio only stops consuming it.
- ⚠️ Each switch restarts the engine, briefly interrupting every camera, which the engine status shows
  (SYS-01).
- ⚠️ A switch waits for the camera: a parking on positions Vyzio manages takes seconds, and a batch
  moves its cameras one after another.
- ⚠️ A parked camera depends on two positions the user must save first, and on the camera answering
  when they are read on the native tier.

## Options rejected

| Option | Why rejected |
| --- | --- |
| The engine stop alone | The camera keeps streaming on the home network; the firmware cut, where it exists, is the only real one. |
| Disabling the camera's PoE port on a managed switch | Wired cameras only, and requires a managed switch; out of scope. |
| Cutting power through a smart plug | Mains-powered cameras only, and requires a compatible plug; out of scope. |
| A firewall on the hub | Works only if the hub is the network's gateway, which a home hub is not. |
| A "none" strategy, kept to tell "not configured" from the software stop | Behaves exactly like the software stop and reads as a privacy mode that stops nothing (principle 4). |
| A "none" strategy that leaves the camera recording | Contradicts PRIV-01. |
| Privacy strategies as values of the protocol enum | A strategy is not a protocol, and the column could no longer say which protocols the camera speaks. |
| One vendor adapter per brand for the camera layer | Couples privacy to the brand; the capability bound to a protocol already says how to reach the camera (ADR-04). |
| Parking to the mechanical stop, with an approximate move back | The stop can still see part of the room, and the return lands nowhere precise; PRIV-12 parks on the Parking slot. |
| Parking on the Surveillance slot | A camera parked where it watches keeps looking at the room. |
| Falling back to the mechanical stop when no Parking position is saved | The strategy would claim more than it guarantees. |
| Letting an unsaved position fail silently | A strategy that does nothing on the camera, with only a log line, is an opaque state (principle 4). |
| Requiring the Parking position alone | The return would depend on a position nobody was asked to save. |
| A strict return from parking | Keeps a camera out of surveillance because it failed to turn, although turned away it films nothing of the room. |
| Privacy ranges held by each camera | Replaced by the scheduled rules of ADR-15, one calendar for every type of range. |
