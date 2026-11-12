# ADR-07: A stream is one quality of one scene with its own role, every stream goes through go2rtc, and the API relays the live view

## Context

A camera serves one or more streams. They decide what Frigate analyses, what it records and what the
user watches live, and each costs a connection the camera may refuse beyond two or three.

- **Decoding is a large CPU cost.** A light sub-stream decodes several times cheaper than the main
  one, and Frigate decodes every frame it receives even when it analyses only some of them, so a
  camera sending more frames than detection uses wastes the difference. An Intel GPU can take the
  decoding, but its codec-specific presets need each camera's codec, which Vyzio does not record.
- **The analysed stream is a trade.** Face recognition, event snapshots, thumbnails and the
  refreshed frame all read the analysed frame: analysing a light stream makes the system lighter and
  most faces too small to recognise. Which matters depends on the scene, which Vyzio does not see
  (CAM-52).
- **Frigate takes exactly one recording input and one analysis input per camera**, possibly the
  same one, and resizes the analysed image to its own size when it is not told the real one.
- **A box with several lenses serves several scenes**; streams of one scene differ only by quality.
- **The live view must move** (LIVE-01), cross the remote overlay (ADR-16), keep the session and
  privacy checks, and never let the browser reach Frigate (ADR-02) or a public server (ADR-03).
  Cameras send codecs the browser's media player does not all carry ([hardware sheets](../hardware/)).

## Decision

A camera's streams are qualities of one scene, each checked and holding its own role under the
stream capability (ADR-04); go2rtc carries every stream once, and Frigate and the live view both read
it there, the live view through a socket the API relays.

- **One lens is one camera.** Streams that share a video source are qualities of one scene; a source
  of its own is another camera. The ONVIF profiles say which, by their source.
- **Streams are ranked by size, not labelled.** The interface shows each stream's measured
  resolution, and only an exact one is kept: a nominal label (DVRIP) or a size announced for another
  address than the one used is dropped. A stream is proposed only once the camera attests it exists.
- **Each stream is checked alone and holds one role**: record, detect, both, or none. Exactly one
  stream records; giving a role takes it from the stream that had it, so recording never lapses.
  With no detect stream, detection runs on the recording stream. A failing detect stream does not
  move detection by itself (CAM-55).
- **By default the most detailed stream records and the lightest detects** (CAM-53); a camera
  whose streams cannot be listed keeps one stream doing both.
- **The streams are found once, then they are the user's.** A verification refreshes their measured
  size and never adds or removes one; the user adds one, from what the camera lists on demand or by
  its path over RTSP. A stream's path is its identity and never changes; a change of stream protocol
  replaces every stream (CAM-57, CAM-58).
- **Frigate is told the analysed size only when it is measured exactly**, and never above it.
- **Every stream Frigate or the live view reads is declared once in go2rtc**, from the stream's
  protocol, port and account (ADR-04, ADR-06). Frigate reads each role back from go2rtc's local
  restream, video only, so a camera keeps one connection per stream for detection, recording and
  every viewer.
- **The API relays the live socket, byte for byte.** The browser opens a WebSocket on the API, which
  opens go2rtc's media socket through Frigate's internal port. It is accepted only for a camera in
  surveillance, not in privacy mode, with the owner session (ADR-16); each refusal closes it with its
  own code; turning privacy mode on closes the camera's open sockets at once. The API reads only
  go2rtc's error messages, to remove any camera account from them.
- **Watching adds no camera connection**: the live view plays one of at most two streams already
  held, the quality chosen there and never stored. Sound is asked only while it is on; nothing is
  transcoded.
- **The refreshed frame**, fetched through the API from Frigate, is the thumbnail and the live
  view's fallback (LIVE-12).
- **Hardware decoding follows the host, apart from the detection tier** (ADR-08): the
  codec-agnostic Intel decoding when an Intel GPU is found, no decoding option otherwise, leaving
  Frigate's defaults.
- **The camera's frame rate is aligned on the detection rate, on the camera**, through a stream
  configuration capability proven like any other (ADR-04): written only on the detect stream, only
  when it is not the recording one, never blocking the configuration it is applied with. Vyzio keeps
  the rate it found to restore it (CAM-09), the one exception to the camera being the only truth for
  its settings (ADR-11).

## Consequences

- ✅ The decoding cost follows the user's choice of analysed stream, and the trade is shown, not imposed
- ✅ Frigate always gets exactly one recording input and one analysis input
- ✅ A multi-lens box needs no channel notion: it is several cameras
- ✅ The live view moves, crosses the overlay as plain HTTP, and costs no CPU beyond the relay
- ⚠️ go2rtc is a single point of failure: if it stops, detection, recording and the live view stop together
- ⚠️ A Frigate restart cuts the live view, which reconnects; the first image waits for a key frame
- ⚠️ A stream of unknown size may still be enlarged by Frigate's default, notably a sleeping DVRIP
  camera's sub-stream: the API has no decoder to measure it, and go2rtc does not report it
- ⚠️ H.265 does not play on every browser, which then falls back to the refreshed frame
- ⚠️ A stream the camera stopped serving stays listed, failing, until the user removes it
- ⚠️ The oldest Intel generations may need a driver variable the deployment sets; Nvidia and AMD
  need another image and stay out
- ⚠️ A camera without a proven control protocol keeps its own frame rate

## Options rejected

| Option | Why rejected |
| --- | --- |
| One camera carrying several lenses as channels | The channel axis reaches every feature (labels, privacy, PTZ, clips, live) for a minority case |
| The analysed stream chosen automatically, or always the sub-stream, or always the main one | Each is wrong for some scenes, and silently turning face recognition off breaks principle 4 |
| Named tiers (main, secondary) | A two-value model that drops a third stream, and a label Vyzio invents over a size |
| The analysis choice in the detection settings | Apart from the streams it picks among, unable to say a stream failed |
| Several recording streams | Frigate takes one; Vyzio would pick behind the user's back |
| Streams found again at every verification | Brought back what the user removed and pruned what the camera missed once |
| An editable path on a stream | Another path is another stream |
| One capability card per stream | Stream qualities are recorder jargon (principle 1) |
| The live view as one refreshed frame a second | It lags and nothing moves; kept as the fallback |
| WebRTC | The media bypasses the API, publishes a UDP port and needs a STUN server (ADR-03) |
| HLS through the API | Several seconds of delay, and URL rewriting |
| Frigate's MPEG-1 socket | Transcodes every watched camera |
| Frigate and the viewer each reading the camera | One more connection per viewer on cameras that refuse a third |
| QuickSync presets by Intel generation | They are per codec, and Vyzio does not know each camera's codec |
| Probing each codec when the configuration is written | Network calls in a generation that is local and deterministic |
| The user choosing the decoding preset, or setting the frame rate in the vendor app | Asks a non-technical user what principles 1, 5 and 6 spare them |
| Writing the frame rate on a stream that also records | The recordings would stutter |
| Lowering the frame rate in go2rtc by transcoding | Decoding then encoding costs more than the decoding it saves |
| Driving the camera's resolution and codec with its frame rate | Not now: the codec touches browser playback and storage, and needs its own decision; the stream configuration capability can carry them later |
