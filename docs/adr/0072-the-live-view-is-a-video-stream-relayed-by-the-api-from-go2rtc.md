# ADR-72: The live view is a video stream relayed by the API from go2rtc

> Status: Accepted
>
> Amends [ADR-16](0016-live-stream-access-polling-latest-jpg-through-vyzio-frigate-never-exposed.md)
> (the live view plays a stream; the refreshed frame stays for thumbnails and as the fallback),
> [ADR-19](0019-dvrip-xmeye-protocol-go2rtc-as-a-fallback-gateway-transparent-to-frigate.md) (go2rtc
> carries every camera, not only DVRIP ones),
> [ADR-61](0061-camera-connection-data-on-three-levels-access-protocols-capabilities.md) f) and
> [ADR-65](0065-each-video-stream-is-a-checked-object-with-a-role-under-the-stream-binding.md) g)
> (the stream's protocol, port and account build go2rtc's source; Frigate's inputs read go2rtc back).

## Context

The live view shows one frame a second, fetched through the API from Frigate (ADR-16). It lags, and
nothing moves in it (#47).

- go2rtc already runs inside the Frigate container (ADR-19). It turns a camera stream into fragmented
  MP4 over a WebSocket, which the browser's Media Source Extensions play, and Frigate's internal port
  exposes that socket. go2rtc serves only the streams declared in its configuration, and opens a
  camera connection only while something reads that stream.
- Frigate reads each camera directly, one connection per role (ADR-38). A live viewer reading the
  camera too would add another, and small cameras often refuse more than two or three.
- Cameras do not all send what MSE plays: some send G.711 audio, which go2rtc converts by itself, and
  some streams are MJPEG, which MSE cannot carry. Measured per model in the
  [hardware sheets](../hardware/).
- The browser must never reach Frigate (ADR-16), and go2rtc's WebRTC is neutralised (ADR-70).

## Options compared

| Option | Description | For | Against |
|---|---|---|---|
| **A. Keep the refreshed frame** | One frame a second (ADR-16) | Nothing to build | Lags, does not move (#47) |
| **B. MSE over a WebSocket relayed by the API** | The browser opens a socket on the API, which relays it to go2rtc | About a second of delay; plain HTTP, so it crosses the overlay (ADR-67); the API keeps the session and privacy checks | One socket relay to keep in the API |
| **C. WebRTC** | go2rtc's WebRTC, signalled through the API | Lowest delay | The media bypasses the API: a UDP port of the Frigate container published, ICE candidates through the overlay, a STUN question ADR-70 forbids |
| **D. HLS** | Playlist and segments proxied by the API | Native on Safari | 3 to 6 seconds of delay, URL rewriting |
| **E. jsmpeg** | Frigate's MPEG-1 socket | Plays everywhere | ffmpeg transcodes every watched camera |

**Option B chosen.**

## Decision

**a) Every camera goes through go2rtc, Frigate included.** Each stream Frigate or the live view reads
is declared once in go2rtc, named after the camera and its rank. Frigate reads each role back from go2rtc's loopback
restream, video only, so a camera keeps one connection per stream, shared by detection, recording and
every viewer. Frigate records no sound, so it takes no audio track.

**b) The API relays a WebSocket, byte for byte.** The live socket is accepted only for a camera in
surveillance and not in privacy mode, with the owner session (ADR-54). The API opens go2rtc's socket
through Frigate's internal port and copies frames both ways until either side closes. It reads only
go2rtc's error messages, to remove any camera account from them before they reach the browser. Each
refusal, and a stream go2rtc cannot open, closes the socket with its own code, which the interface
tells apart. Turning privacy mode on ends the camera's open live sockets at once, with the privacy
code.

**c) Two qualities, the low one first.** The live view plays at most two streams, so watching never
adds a connection beyond two: the streams holding a role, plus one checked stream when both roles share
a stream. The smaller plays first and the larger on demand, ranked by size when every size is known,
else by the main stream. A camera with one such stream offers one quality. The choice is made in the live view and lasts as long as it
is open: nothing is stored, no camera setting changes. The camera list says which qualities a camera
offers.

**d) Sound only while it is on.** The player asks for the codecs the browser plays; go2rtc answers
with the tracks it will send. The view opens muted and asks for the video alone; turning the sound on
opens the stream again with it. Both tracks share one buffer, so a camera that pauses its sound, as
some do while they move, freezes the picture and leaves it behind for good: muted, nothing waits on a
sound nobody hears, and with the sound on, a picture fallen behind the clock opens the stream again.
A browser that fails to decode the sound gets the video alone. No ffmpeg transcode is configured, so watching
costs no CPU beyond the relay.

**e) The refreshed frame is the fallback.** When the browser cannot play the video, or the stream
does not arrive, the live view shows the refreshed frame and says why in one sentence, with a retry
when the cause may pass. A refusal for privacy mode or for a camera that no longer exists says so,
without a frame. The thumbnails keep the refreshed frame.

**f) WebRTC stays neutralised.** Nothing changes for ADR-70: no candidate, no ICE server.

## Consequences

- The live view moves. The first image waits for the camera's next key frame, then the player keeps
  close to the live edge rather than replaying what it fell behind on.
- go2rtc becomes a single point of failure for every camera: if it stops, detection, recording and
  the live view stop together, where a direct read kept Frigate going.
- A Frigate restart, after a setting change, cuts the live view, which reconnects.
- H.265 plays on Chrome, Edge and Safari with hardware decoding, not on Firefox, which falls back.
- The SAD's flows gain the browser's socket and the API's relay to go2rtc.
