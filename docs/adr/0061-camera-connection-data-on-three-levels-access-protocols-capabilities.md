# ADR-61: A camera's connection data on three levels: access, protocols, capabilities

> Status: Accepted
>
> Amends [ADR-19](0019-dvrip-xmeye-protocol-go2rtc-as-a-fallback-gateway-transparent-to-frigate.md) and
> [ADR-22](0022-camera-capability-catalogue-brand-protocol-decoupling-vendor-presets-manual-onboarding.md)
> on where the stream transport lives (`Camera.StreamProtocol`, the stream kept out of the capability
> model), ADR-22 also on what a binding's `ConfigJson` holds (no port, address or account any more),
> [ADR-23](0023-camera-reachability-monitoring-periodic-tcp-polling-independent-of-frigate.md) on the
> port the reachability poller knocks on (`Camera.Port`),
> [ADR-24](0024-protocol-layer-separated-from-capability-layer-onvifclient-supportedprotocol-privacystrategy.md)
> and [ADR-30](0030-native-v380-image-settings-rejected-imagesettings-through-onvif-only.md)
> on `Camera.SupportedProtocols` and on where the V380 device id is kept (a binding's `ConfigJson`),
> [ADR-28](0028-cascading-multi-protocol-capability-detection-and-the-manuallyconfigured-flag.md) on the
> candidates the cascade tries (only the protocols that answer) and on the manual choice (only among
> the camera's protocol rows), and
> [ADR-56](0056-the-onvif-endpoint-is-asked-of-the-camera-not-assumed-by-convention.md) on where the
> resolved ONVIF endpoint is stored (`Camera.ProtocolEndpointsJson`).

## Context

A camera's connection data sits on the wrong level:

- `Camera.Port`, the stream paths and `Camera.StreamProtocol` read as facts of the whole camera, but
  they only concern the video stream. ONVIF, DVRIP or V380 answer on other ports, which the clients
  hardcode.
- The video stream is a capability for the product ([SPECS](../SPECS.md) 2.3) and on screen since
  #155, but not in the data: ADR-22 kept it out of the binding model, so a DVRIP-only camera and an
  RTSP camera take two different paths through onboarding, verification and discovery.
- The per-protocol level exists by halves: `SupportedProtocolsJson` lists the protocols a verified
  capability proved, `ProtocolEndpointsJson` holds the ONVIF address, and neither says how to reach a
  protocol or whether it answers.
- The V380 device id is a fact of the V380 service, yet it is kept in the PTZ binding's `ConfigJson`,
  where no other V380 capability can read it.
- A camera account is one account: a Tapo camera wants its local account for the stream and ONVIF,
  and its cloud account for the lens cut over KLAP. Nothing can hold the second without replacing the
  first.
- Every capability probe finds out alone that a protocol does not answer, or refuses the account: a
  detection run knocks on a silent DVRIP port, or tries a wrong account, once per capability that names
  it. Whether the camera can be reached and whether a capability works are one question in the code.

## Options compared

| Option | Description | For | Against |
|---|---|---|---|
| **A. JSON bags on `Camera`** | Grow `ProtocolEndpointsJson` into one JSON object per protocol (port, account, state) | No new table | A state and an account per protocol are records with a lifecycle, hidden in an unqueryable column; the half-used pattern this ADR removes |
| **B. Per-protocol rows, the stream as a binding** | A `CameraProtocol` row per protocol the camera speaks; the stream becomes a `CameraCapabilityBinding` | Each fact has one home; one path for every transport | A migration that drops columns |
| **C. Reach data in each binding's `ConfigJson`** | Port, account and address stored with the capability that uses them | No new entity | ADR-56 d) already rejected it: one device fact copied per capability, out of reach of the callers that hold no binding |

**Option B chosen.**

## Decision

**a) Three levels, each piece of data in exactly one.**

1. **Identity and access, the `Camera`**: its name, its address on the network, its account. It keeps
   what is not connection data (status, privacy mode, retention, detection).
2. **Protocols, the `CameraProtocol` rows**: one per protocol the camera speaks (RTSP, ONVIF, DVRIP,
   V380, Tapo KLAP), unique per camera. Each says how to reach the protocol and whether it answers:
   its port (empty means the protocol's usual one; for ONVIF, the one asked of the camera), the
   ONVIF device service address (moved from ADR-56 d), the V380 device id (moved from the PTZ
   binding), an optional specific account that **overrides** the camera's for that protocol alone,
   and the result of its last check.
3. **Capabilities, the `CameraCapabilityBinding` rows**: video stream, orientation, hardware cut,
   image settings. Each picks one protocol and carries its own settings.

`Camera.Port`, `Camera.StreamProtocol`, `SupportedProtocolsJson` and `ProtocolEndpointsJson` leave
`Camera`, and the `StreamProtocol` enum goes with them: a stream protocol is a `SupportedProtocol`.
A binding's `ConfigJson` keeps only the capability's own settings (the left and right swap, native
presets); port, address and account are the protocol's.

**b) The video stream is a capability binding.** A camera has one `Stream` binding, created at
onboarding, over one of the protocols with a registered stream provider (RTSP or DVRIP, the same
declaration discovery reads, ADR-32). The stream verification is its probe: it sets `Verified` and
keeps the verifier's reason in `LastError`. Its settings are the camera's streams of ADR-38
(qualities, paths, the detect choice); they stay keyed by camera, which is the same thing, since a
camera has one stream binding. A path is a setting only over RTSP, where ONVIF can also report it.
The stream is not part of the detection cascade: onboarding chooses its protocol from what discovery
saw, and the user can change it. Detection binds it only on a camera that has none: it checks the
stream protocols in their order, RTSP then DVRIP, and keeps the first that answers and whose stream
check passes, or else the first that answers, unverified with its reason (d). A camera without a stream binding is verified as not connected and
has no place in the generated configuration until one is chosen: its stream reads "to configure",
like any unbound capability. Changing the stream's protocol or path is a connection change, like a new
address: the camera goes back to being checked before surveillance takes it up again.

**c) The protocol and the capability are checked apart, each with its own contract.** The protocol
check asks one thing: does the camera answer on this protocol, **with this protocol's account**. It
reaches the protocol, then logs in once with the account the protocol resolves (e); it never guesses
an account and never logs in on a protocol that did not answer. Its result, answers, refuses the
account, or cannot be reached, is recorded on the protocol's row. The capability check is the
binding's own: a capability test first requires its protocol to answer, and a protocol that is silent
or refuses the account fails the capability with the protocol's reason, without calling the
capability's provider. Within one gesture a protocol is checked once, however many capabilities name
it. The user can also check one protocol alone; that check goes through no capability, so it is never
suspended by a failing stream. The stream follows the same rule: its protocol answers first, then the
stream verification runs. The reachability poller of ADR-23 knocks on the stream's protocol port.

What proves that a capability works, beyond its protocol answering, stays the capability's
provider's probe here. A read-only proof per capability, and a "to confirm" state for a capability
that has none, are the follow-up issue #221: the capability contract is left apart for it.

**d) Detection picks among the protocols that answer.** The detection cascade of ADR-28 checks each
candidate protocol once, then tries the capabilities only on those that answered, in the same priority
order. `ManuallyConfigured` keeps its meaning. A manual choice names one of the camera's protocols,
one of its rows that can carry the capability, answering or not (a sleeping battery camera must stay
configurable): it is saved, and its test says when the protocol does not answer. A protocol the camera
does not have is refused: the user adds it first, and it is checked then. Binding a capability never
creates a protocol row on the side, so the rows only grow by a check or by the user's own gesture.
The protocol search can also run alone: it binds nothing and keeps every row the camera had. After detection, a protocol row that could not be reached, that no capability uses and
that holds nothing the user entered is dropped: the rows list what the camera speaks, not what Vyzio
tried. A protocol that refused the account is kept: the camera speaks it. Once the camera exists, the
user adds a protocol (checked at once) and removes one; a protocol a capability goes through is never
removed, whatever the number of capabilities or streams bound to it.

**e) One account resolution.** Every client asks the camera for the account of the protocol it speaks,
and gets the protocol's specific account when one is set, the camera's otherwise. No client reads the
camera's account directly. The specific account is used only to talk to the camera on the local network,
like the camera's.

**f) Frigate reads the stream from its binding**: the transport from the stream binding, the port and
account from that protocol's row, the paths from the streams.

How each level is read and written, the check per protocol and the rows' lifecycle are in
the TAD [`design/camera-connection.md`](../design/camera-connection.md). The screen that shows the
three levels is framed in the [DESIGN SYSTEM](../DESIGN%20SYSTEM.md) § Capability cards.

## Options rejected

**Keeping the stream outside the capabilities (ADR-22).** It was cheap while every camera streamed
over RTSP. With DVRIP-only cameras it forks onboarding, verification and discovery on the transport,
which is the special-casing the capability model exists to remove.

**Moving the streams under the stream binding.** A camera has one stream binding, so keying the
streams by binding rather than by camera buys a migration and changes nothing they can express.

**A protocol check that stops at reach.** It spares a login, and it leaves a protocol reading "answers"
while every capability on it fails on the account: a state without a justification (principle 4), and
the account failure found again by each capability. The lockout risk that argued for it (ADR-56 c) is
met otherwise: one login per protocol and gesture, only after the protocol answered, only with the
account the user gave, never a guess.

**A manual choice among every protocol of the capability.** It let a card offer RTSP on a camera
that only speaks DVRIP, and saving it created the protocol row silently: a choice the camera cannot
honour, and a level 2 row the user never added. Choosing among the camera's own rows keeps each level
the home of its data; adding a protocol is one gesture away.

**Carrying the existing rows over, or reading a camera without a stream binding as RTSP.** The
installation is a single deployed instance and its owner chose a clean schema over a data migration
and over backward compatibility. A default transport would be a disguised value: a camera that
streamed over DVRIP would silently read as RTSP and fail.

## Consequences

- ✅ Every connection detail has one home, and the screen can show each one once
- ✅ A DVRIP-only camera and an RTSP camera take the same path, which unblocks discovery readiness
  from the stream capability (#210)
- ✅ A Tapo camera keeps its local account and gets its cloud account for KLAP alone
- ✅ A silent protocol, or a refused account, costs one check per detection instead of one per
  capability, and is named on the protocol, where it is fixed
- ✅ A failed stream check keeps its reason, like any other capability
- ⚠️ The clean schema leaves the cameras already added without a stream binding: detection binds it
  when a stream protocol answers, otherwise its stream protocol is chosen once on its stream card, and
  its stream port entered again when it is not the usual one
- ⚠️ A capability over a protocol the camera does not list yet takes two gestures: add the protocol,
  then choose it
- ⚠️ A protocol that answers with its account says nothing yet about each capability on it: until
  #221 gives each capability its own read-only proof, the capability's provider probe stays that proof
- ⚠️ Each check logs in once per protocol: a camera that locks its account after repeated failures sees
  one attempt per gesture, never a burst
- ⚠️ A camera that sleeps (battery DVRIP) answers no protocol while asleep; its capabilities fail
  until it is woken, as before, and the card says the camera did not answer
