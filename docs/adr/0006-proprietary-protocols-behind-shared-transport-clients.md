# ADR-06: Proprietary protocols are spoken by shared transport clients, and DVRIP video reaches Frigate through go2rtc

## Context

Principle 6 asks Vyzio to drive every camera directly, through a proprietary protocol where the
camera offers nothing else. Two such protocols are in reach:

- **DVRIP**, the binary protocol of the Xiongmai firmware, spoken by many brands alike. Several
  capabilities need it on the same camera: the video stream of a camera that serves no RTSP, image
  settings, orientation and its native presets. Battery models often keep RTSP and ONVIF closed and
  answer DVRIP only ([ICSee sheet](../hardware/icsee.md)).
- **V380**, whose every command needs a device number the camera does not print anywhere. ONVIF
  answers over TCP from the container network, where a UDP broadcast does not cross, and in a home
  with two V380 cameras a broadcast may be answered by the other one.

Each capability writing its own framing, login and error handling would copy the same protocol
several times, each copy with its own mistakes; one shared client is fixed and checked in one place, against a
reference client and a real camera. A capability
probe that swallows a failure leaves the user with a generic message instead of the cause (UI-01).

Frigate reads RTSP only, and does not speak DVRIP.

## Decision

Each proprietary protocol has one shared client that only carries the protocol, and DVRIP video
reaches Frigate restreamed by the go2rtc that Frigate already embeds.

- **One client per protocol, transport only.** The DVRIP client connects, logs in with the
  protocol's account (ADR-04), frames and reads the messages; it holds no capability logic. Every
  DVRIP capability provider depends on it, as the ONVIF ones depend on the ONVIF client.
- **It opens a session that carries several commands**, sent in order and answered in order, so a
  capability that needs a held connection gets one without a login per command (ADR-09).
- **It fails with the real cause.** A read or a write that does not go through raises an error that
  says whether the camera refused it, with its answer, or could not be reached, with what timed out;
  never a swallowed failure. The protocol check stays the one exception: it answers a state, never
  an error (ADR-04).
- **Every exchange is bounded in time as a whole**, connection and login included, so a camera that
  never answers cannot hold a caller.
- **A configuration write is a read, a change of the known fields, and the whole node written
  back.** The client never builds a configuration from scratch, since its schema varies between
  firmwares.
- **The V380 device number has one home and one resolution**, shared by every V380 caller: the
  number stored on the camera's V380 protocol, else the number read from the camera's ONVIF serial,
  else the number asked of the camera's own address, never by broadcast; typing it on the protocol
  stays the last resort. A number found is stored on the protocol (ADR-04).
- **A DVRIP stream reaches Frigate through go2rtc.** go2rtc logs in over DVRIP and serves the stream
  back as RTSP inside the Frigate container; Frigate reads it like any other stream (ADR-07).
- What a protocol puts on the wire, its command codes and each model's quirks, are the code's and
  the [hardware sheets](../hardware/)'.

## Consequences

- ✅ One framing, one login and one error contract per protocol: a protocol fix lands once for every
  capability
- ✅ A failed probe or command names its cause, which the capability card and the diagnostic line
  show (UI-01)
- ✅ A configuration field Vyzio does not model is never lost by a write
- ✅ A DVRIP-only camera streams without a new container, and Frigate sees RTSP only
- ✅ go2rtc's other source protocols are reachable the same way when a camera needs one
- ✅ A V380 camera in a home with two of them gets its own number
- ⚠️ A sleeping battery camera answers nothing; go2rtc retries but cannot wake it, so it streams only
  once woken
- ⚠️ A protocol command is trusted only once validated against a real camera; a command found only
  in a third-party source is never sent on a guess

## Options rejected

| Option | Why rejected |
| --- | --- |
| A protocol client per capability | Copies the framing and login for each capability; one transcription error broke two capabilities at once |
| A client that swallows failures and returns nothing | The user saw a generic message and support had no cause to read |
| A dedicated sidecar container turning DVRIP into RTSP | One more container and attack surface for what the go2rtc inside Frigate already does |
| DVRIP offered only as a fallback when RTSP is closed, recognised by its first answer byte | The stream protocol is a capability choice like any other, tried in its priority order and checked by its login (ADR-04) |
| Finding the V380 device number by UDP broadcast | It does not cross the container network, and in a home with two V380 cameras it may return the other one's number |
| The V380 device number kept with the PTZ capability | No other V380 capability could read it; it is a fact of the protocol |
| Native V380 image settings | Rejected under ADR-11 |
