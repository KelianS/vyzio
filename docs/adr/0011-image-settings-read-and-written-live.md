# ADR-11: Image settings are a capability read and written live on the camera, never persisted

## Context

The user adjusts brightness, contrast, saturation, sharpness and night vision from Vyzio rather than
from the vendor app (UC-IMG-01, principle 6). As for orientation and the hardware cut, what a camera
can do depends on its protocols, not its brand (CAM-10), and a control is offered only once proven
(IMG-01, CAM-13).

Unlike PTZ positions or privacy, there is nothing of Vyzio's own to keep: the camera holds its image
settings and applies them, and a copy in Vyzio could only drift from it.

Protocols differ in what they carry. ONVIF has a standard imaging service, though some cameras do not
implement it ([V380 sheet](../hardware/v380-pro.md)). DVRIP carries brightness, contrast and
saturation in a configuration whose shape varies between firmwares; sharpness and day and night
mode are not in it ([ICSee sheet](../hardware/icsee.md)). No command is sent on a guess (ADR-06).

## Decision

Image settings are one more capability, bound to a protocol and proven like any other (ADR-04), whose
values Vyzio reads from the camera and writes to it on each request and never stores.

- **One provider per protocol**, behind the same capability contract as PTZ and the hardware cut:
  ONVIF through its imaging service, DVRIP through the shared client (ADR-06). A protocol with no
  validated command has no provider.
- **The read is the proof**: settings read back from the camera verify the capability (ADR-04).
- **Read and write are live.** A read asks the camera; a write sends the change, then reads the
  camera again and returns what it actually applied, since a firmware may clamp or round.
- **Nothing is persisted.** The binding records only which protocol carries the capability and its
  last check; no value is kept in the database.
- **A provider offers only the settings its protocol carries.** A setting the protocol does not carry
  is never written and its control is not shown.
- **A DVRIP write goes through the whole configuration** (ADR-06): only the known fields change, found
  wherever the firmware put them.
- **A check that fails names its cause** on the capability (ADR-04, ADR-06), never a generic
  failure.

## Consequences

- ✅ No migration for a new protocol, and no copy that can disagree with the camera
- ✅ The pattern of the other capabilities is reused whole: binding, proof, priority order
- ✅ A field Vyzio does not model survives every DVRIP write
- ⚠️ Every display of the panel costs a round trip to the camera, and a camera that does not answer
  shows no values (CAM-08)
- ⚠️ ONVIF ranges are assumed from the standard; a firmware applying its own bounds clamps silently,
  which the read back shows
- ⚠️ DVRIP cameras get no sharpness and no night vision until a command is validated on hardware
- ⚠️ A V380 camera has no working image setting known: ONVIF imaging is not implemented on it, and
  no native command is
- ⚠️ The frame rate Vyzio writes on its own initiative is the one exception where a value is kept,
  to be restored (ADR-07)

## Options rejected

| Option | Why rejected |
| --- | --- |
| Storing the settings in Vyzio and pushing them to the camera | A second truth that drifts whenever the camera or its app changes a value |
| A new binding model for image settings | The existing capability binding already says which protocol and which result |
| Sending sharpness and night vision over DVRIP on a guess | Undocumented command on real hardware; a control that does nothing is worse than none |
| Native V380 image settings through its infrared light command | Built, then sent to a real camera without any effect; the command appears in only one of two open implementations, undocumented there, and the vendor app has no such setting to capture traffic from; removed whole |
| Writing a DVRIP configuration built from scratch | Its schema varies between firmwares, and an unmodelled field would be lost |
