# ADR-68: A camera is created from its access alone

> Status: Accepted, amended by [ADR-71](0071-the-vendor-is-a-help-hint.md) on e) (the vendor is a
> help hint: picked on the add screen for its help sheet only, never stored)
>
> Amends [ADR-12](0012-camera-management-driven-by-vyzio-applied-to-frigate.md) (the camera is created
> before any check, its stream checked from its page),
> [ADR-22](0022-camera-capability-catalogue-brand-protocol-decoupling-vendor-presets-manual-onboarding.md)
> and [ADR-28](0028-cascading-multi-protocol-capability-detection-and-the-manuallyconfigured-flag.md)
> on when they act (detection runs from the camera page, not at creation),
> [ADR-61](0061-camera-connection-data-on-three-levels-access-protocols-capabilities.md) b)
> (the stream binding is no longer created when the camera is added, nor its protocol chosen from what
> discovery saw: detection or the user's choice on the stream card binds it; a camera whose stream
> never worked is to be set up, and stays out of the generated configuration until it works),
> [ADR-65](0065-each-video-stream-is-a-checked-object-with-a-role-under-the-stream-binding.md) e) (no
> stream path is entered when the camera is added, and a camera without one is never refused) and
> [ADR-21](0021-ptz-parking-and-a-generic-onvif-adapter-a-layered-privacy-mode-strategy.md) (no add
> step for the privacy mode and the surveillance position: the camera page offers them).
> Supersedes [ADR-31](0031-manual-vendor-override-at-onboarding.md) (the brand selector goes).

## Context

Adding a camera and setting up a camera are two screens doing one job twice (#253):

- the add screen still follows the model from before ADR-61: one port, one stream protocol, one path
  and a brand, typed by hand, then a check of that draft before the camera exists;
- the camera page carries the three levels of ADR-61, the stream lines of ADR-65 and the proofs of
  ADR-66, with "Détecter automatiquement" binding the protocols, the stream and the capabilities.

Every change to the camera model has to be made on both, and the add screen drifts: it still asked
for a port after the port left every other screen. It also ties a new camera to RTSP: over RTSP
without a typed path and without a stream list, the camera is refused, although the stream card
already knows how to ask for the path. And the privacy mode and PTZ positions that SPECS 9.3 wanted
as an extra add step (#149) would be a third copy of the camera page's own tabs.

## Options compared

| Option | Description | For | Against |
|---|---|---|---|
| **A. Keep the add form, aligned on the page** | The add screen gains the three levels, the stream lines and the proofs | The camera is complete when it is created | Two screens to keep in step forever, the drift of the context |
| **B. A wizard over the page's steps** | A guided sequence borrowing the page's components before the camera exists | Leads the user step by step | A second flow around the same components, a draft camera to hold, and the extra add steps of #149 again |
| **C. Created from its access alone, then its page** | The add screen holds discovery and the access; confirming creates the camera and opens its page, where everything else is set | One place sets up a camera, new or not; no draft to check | A camera exists before its stream works, so it needs a state for that |

**Option C chosen.**

## Decision

**a) The add screen creates the camera from its access alone.** It holds the network discovery and
the access: name, address, account. Choosing a discovered camera or typing an address, then
confirming, creates the camera with that access and nothing else: no port, protocol, stream, path or
brand, and no check before it exists. Discovery hands over the address only; what it found is found
again by detection, with the account the user gave. A candidate that cannot be added yet keeps the
discovery step that says what to prepare.

**b) A new camera has no protocol and no stream until it is detected.** Creating it runs nothing in
the background. Its page opens on arrival and runs the page's own detection when the camera was never
detected, so the result shows where the user is, through the same action and state as a detection
they start. Detection binds the stream as ADR-61 b) already does for a camera without one.

**c) A camera never depends on RTSP.** No camera is refused for a missing RTSP path. When detection
leaves the stream unchosen because the camera answers over RTSP without listing its streams, the
stream card asks for the path (ADR-65 e).

**d) "To set up" is a camera state.** A camera reads as to be set up until it enters surveillance:
while its stream never worked, and while its stream works but the restart has not taken it in yet.
It reads so wherever its status shows: the camera list, its page header, and the hub, where its tile leads to its
page and attempts no image. It enters the generated configuration once its stream works, and
surveillance through the restart trigger, which concerns it only from then on. The settings that need no stream
(detection, retention, privacy) are saved meanwhile and applied when it enters surveillance.

Before the stream first works, the state is the camera's only status: offline or a configuration
error mean nothing before a first success. It never comes back once the camera is in surveillance,
and once the stream has worked, a later failure, a change of stream protocol included, reads as the usual offline
or error states, since what was added is trusted. Until it enters surveillance the camera is a target like any other
for schedules and the cameras a person's notifications are filtered by, which take effect once it
enters surveillance; it has no live view, and the history has nothing for it.

**e) No brand is chosen when adding.** The brand selector of ADR-31 goes, and the add screen hands
over no brand. Detection records no brand either, so no brand's preset applies to a new camera:
every capability is detected the same way, by its proof (ADR-66). On the add screen, a brand
discovery recognises may still be shown, only to help the user tell the camera apart.

**f) The camera page is where a new camera is set up**, with the same components as for any camera.
Privacy mode and PTZ positions are set on its tabs, not in an add step. How the page reads for a new
camera is framed in [SPECS](../SPECS.md) 2.2.

## Options rejected

**Checking the connection before creating the camera.** It refused a camera the page could have
helped with, and checked a draft by rules the page already applies; the page says what answers.

**Discovery handing over its findings** (the protocols that answered, the stream readiness). It
spares one detection, but carries findings made without the account into the camera as facts, and
keeps a second path that sets protocols and streams beside detection.

**Detecting in the background at creation.** The user lands on a page whose state changes under
them with no visible cause; running it from the page shows the same work as the gesture they already
know.

**Refusing an RTSP camera without a path.** It made RTSP a precondition of existing, which the stream
card made needless.

**A manual brand selector.** It steered detection on a declaration rather than on what the camera
answers, and kept a field only the add screen needed.

**A wizard, or badges on the tabs not set yet.** Unset tabs hold their defaults and work as they
are; pushing the user through each one slows the start without making the camera safer.

## Consequences

- ✅ One screen sets up a camera, new or existing: a change to the camera model is made once
- ✅ A camera that does not speak RTSP, or does not list its RTSP streams, is added like any other
- ✅ Adding takes the access and a confirmation; the rest is optional and has its defaults
- ⚠️ A camera can exist without working: the "to set up" state must read clearly wherever the
  camera shows
- ⚠️ No brand steers detection any more: every new camera is on the blind path, where a capability
  that can only be confirmed is added by the user
- ⚠️ Discovery and detection still both look at the camera: discovery could later shrink to finding
  addresses, so that its logic is not kept beside the protocol and capability checks
- ⚠️ PTZ positions are saved from the live view, which opens once the camera is in surveillance: a
  new PTZ camera reaches privacy parking only after its stream works
