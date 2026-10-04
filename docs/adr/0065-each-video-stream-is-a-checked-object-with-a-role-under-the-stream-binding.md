# ADR-65: Each video stream is a checked object with a role, under the stream binding

> Status: Accepted
>
> Amends [ADR-38](0038-camera-stream-model-one-stream-one-quality-separate-detect-and-record-roles.md)
> on who holds the `record` and `detect` roles (a role per stream instead of the most detailed stream
> recording and `Camera.DetectStreamId` naming the analysed one), on where the analysis choice is made
> (on the stream, no longer in the detection settings) and on the streams found again at every
> verification (they are found once, then the user's), and
> [ADR-61](0061-camera-connection-data-on-three-levels-access-protocols-capabilities.md) b) and c) and its
> rejected option "Moving the streams under the stream binding" (the streams now belong to the
> binding, each with its own protocol, state and check; the reachability poller follows the recording
> stream's protocol; a stream's path is no longer a setting that changes: it is chosen when the stream
> is added and stays its identity, so only a protocol change is a connection change of the stream, e).

## Context

Since ADR-61 the video stream is a capability binding, but a single one per camera, holding the
streams of ADR-38 as settings. Each stream lives its own life, yet none of it shows:

- a lighter stream can fail while the most detailed one works, and nothing says so: only the stream
  that records is verified;
- a stream cannot be removed, the way orientation can, nor one added back;
- the analysed stream is chosen in the detection settings ("Image analysée"), apart from the streams
  it picks among, and the most detailed stream always records whatever the camera serves.

Frigate accepts **one input per role**: one `record` input and one `detect` input per camera, the same
input possibly carrying both. Any model that lets two streams record, or none, produces a
configuration Frigate refuses.

## Options compared

| Option | Description | For | Against |
|---|---|---|---|
| **A. One capability card per stream** | Each stream becomes its own binding and card | Each stream checked and removable like any capability | Stream qualities are recorder jargon (principle 1); the camera's capability is "see and record", not "serve three encodings" |
| **B. Streams under the one stream binding, each checked, with a role** | The binding keeps one card and one overall state; each stream is a row under it with a protocol, a role and a last check | One card for the user, one object per stream in the data; the roles read on the streams they concern | A stream row per camera stream to keep, a migration |
| **C. Keep ADR-38 and add a state column** | Streams stay settings keyed by camera, the detect choice stays on the camera | Smallest change | The roles stay split between the camera (detect) and a rank convention (record); no removal |

**Option B chosen.**

## Decision

**a) A stream is a row under the camera's stream binding.** `CameraStream` belongs to the `Stream`
binding, not to the camera: a camera without a stream binding has no streams. Each stream carries its
rank and measured size (ADR-38), and now:

- its **protocol**, one of the camera's stream protocols (RTSP or DVRIP). A stream the camera reports
  takes the binding's protocol; a stream the user adds picks one of the camera's rows that can carry
  a stream. The binding's protocol stays the capability's (ADR-61 b): the one its check starts with,
  the one the streams are found over and a new stream is offered first. The reachability poller
  (ADR-23) knocks on the recording stream's protocol, since the camera status follows that stream;
- its **role**: record, detect, both, or none (a stream kept but unused);
- its **last check**: verified or not, when, and the reason of a failure.

`Camera.DetectStreamId` leaves the camera: the analysed stream is the one whose role says so. The
binding records when it found its streams (`StreamsFoundAt`, e), a fact of the stream capability,
not a setting, so it is a column rather than a key of its `ConfigJson`.

**b) One guard: exactly one stream records.** Exactly one stream holds the record role, since
Frigate takes one. Giving a role to a stream takes it from the stream that had it, so the record role
moves in one gesture and never lapses. The stream that records cannot be removed or lose its record
role, so it is only offered the roles that record: the user first gives recording to another stream.
A stream kept but unused holds the role none.

**c) Detection falls back to the recording stream.** At most one stream holds the detect role. When
none does, because the detect stream was removed or its role taken off, detection runs on
the recording stream, and the stream card says so. A failing detect stream does not move detection by
itself: Vyzio shows the failure on the card and leaves the choice to the user.

**d) Defaults.** When the streams are found, the most detailed one records and the lightest detects
(ADR-38's default, unchanged); a single stream does both. Other streams hold no role.

**e) The streams are found once, then they are the user's.** The first verification that enumerates
the camera's streams adds them. After that, a verification refreshes the measured size of the streams
it can match, and never adds or removes one: a stream the user removed does not come back by itself, and a stream
the camera stopped serving fails its check until the user removes it.

The user adds a stream ("Ajouter un flux"), checked at once, from a list the camera is asked for **on
demand**, when the form opens: over RTSP its ONVIF profiles, over DVRIP its main and secondary
qualities. The list is asked at the capability level, once the protocol answers (ADR-61 c); it offers
only the streams not already listed, so a removed stream comes back through it, and is read by quality,
not by path. Over RTSP its last item lets the user type a path the camera did not list, the only entry
when the camera lists nothing; over DVRIP, where a stream is never a typed query, the two qualities of
ADR-38's convention are offered when the camera does not list them. This on-demand list never changes
the streams by itself: only the user's choice adds one.

**A stream's path is its identity.** The path is chosen when the stream is added, or entered at
onboarding for the main stream, and never changes afterwards: no stream line edits it. A wrong path
is fixed by adding the right stream with the record role, which takes it from the old one (b), then
removing the old one.

**An RTSP stream always has a path.** Choosing the binding's protocol, by the user or by detection,
replaces the streams, added ones included, by the streams laid out over that protocol, with the
defaults of d). Over DVRIP the main quality is laid out by convention, the others are found at the
next verification. Over RTSP the camera is asked for its streams, as the add form does, and the
streams it reports are laid out; when it lists none, or cannot be asked, the user picks or types the
first stream's path in the protocol choice, and without one the choice is not applied. Onboarding
over RTSP without a typed path lays out the streams the camera lists, and without any is refused the
same way. Detection binds the stream over RTSP only when the camera lists its streams. The protocol
choice says what it replaces before it runs.

**f) Each stream is checked, at the capability level.** A stream check first requires its
protocol to answer with its account (ADR-61 c), then probes that stream. The stream capability's check
checks every stream; the camera status follows the recording stream, as it did the main one.
A single stream can be checked alone.

**g) Frigate reads the streams' roles.** The `record` input is the recording stream,
the `detect` input the detect stream or, without one, the recording stream; each input is built from its
own stream's protocol, port and account. `detect.width/height` follow ADR-38 on the analysed stream.

The stream lines sit in the stream card's `Options` ([DESIGN SYSTEM](../DESIGN%20SYSTEM.md) § Capability cards).

## Options rejected

**Several recording streams, "at least one records".** It reads as the lighter guard, but Frigate
refuses two `record` inputs: Vyzio would have to pick one behind the user's back, a hidden decision
(principle 4). Exactly one, moved in one gesture, says what runs.

**Moving detection off a failing stream automatically.** It would keep detection up, but Vyzio would
change a choice the user made on its own initiative and hide the failure it reacts to.

**Refreshing the streams at every verification (ADR-38).** It kept the list in step with the camera,
and it brought back every stream the user removed, and pruned one the camera missed once. The list is
the user's once found.

**The analysis choice in the detection settings.** It sat apart from the streams it picks among, and
could not say that a stream failed.

**An on and off switch per stream.** It kept a stream listed but unused, which the role none already
does; with removal, it made three ways not to use a stream.

**A button that finds the streams again.** It would have redone e) behind one more action; the list
asked on demand when adding a stream brings back what the user wants without touching the rest.

**Carrying the main stream's path to the new protocol.** It kept one line across a protocol change,
but an RTSP path means nothing over DVRIP, and a line left without a path over RTSP could only be
fixed by adding another stream.

**An editable path on a stream line.** It let the main stream's path be changed in place, but a line
titled by its quality could then be pointed at another quality and read as one it no longer was. A
stream is what its path serves: another path is another stream, added beside it.

**Keying the streams by camera (ADR-61).** It was the same thing while the streams were settings of
the one binding. Now that each stream has its own protocol and state, they belong to the capability
they describe, and a camera without a stream binding has no stream to show.

## Consequences

- ✅ Every stream shows its role and its own state, and can be removed, or added from what the camera
  serves
- ✅ The analysed stream is chosen where the streams are listed, with their resolution
- ✅ Frigate always gets exactly one recording input and one detection input
- ⚠️ Recording can move to a lighter stream: the recordings then lose detail, which the role's
  explanation says
- ⚠️ A stream the camera no longer serves stays listed, failing, until the user removes it
- ⚠️ An RTSP camera that lists no stream needs its path typed when its stream protocol is chosen,
  and detection does not bind its stream over RTSP
- ⚠️ The clean schema drops the existing streams, detect choices and stream bindings: each camera's
  stream is chosen again, by detection or by the user, which lays its streams out with the defaults
  of d)
