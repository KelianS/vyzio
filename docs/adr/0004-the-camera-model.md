# ADR-04: A camera is its access, the protocols it speaks, and capabilities proven over them

## Context

Vyzio drives every camera directly, whatever its maker (principle 6), for an owner who knows nothing
of its configuration (principle 5), and it never claims what it has not observed (principle 4).

- What a camera can do depends on the protocols it speaks, not on its brand: one protocol serves
  several makers, one maker ships several protocols, and units of one model differ
  ([ICSee sheet](../hardware/icsee.md)). A behaviour chosen by brand locks out every camera that is
  not recognised, against CAM-10 and CAM-11.
- Connection data lives at different levels: the address and the account belong to the camera; a
  port, an endpoint, a device number or a second account belong to one protocol (a Tapo takes its
  cloud account for its proprietary protocol alone, [Tapo sheet](../hardware/tapo-c200.md)); a
  capability has its own settings (CAM-17). The video stream is a capability like the others, and a
  camera that only speaks a proprietary transport must not take another path (CAM-18).
- A standard protocol fixes its contract, never its port nor its paths: the same ONVIF call lives
  at different addresses from one firmware to the next ([Tapo sheet](../hardware/tapo-c200.md)).
- Many protocols answer a login while the capability is absent, and some offer no read at all that
  shows a capability (the hardware sheets). Claiming it breaks principle 4; refusing it locks out
  hardware that works.
- A generic protocol may answer reads without acting, where the maker's own protocol drives the
  hardware ([V380 sheet](../hardware/v380-pro.md)): the order protocols are tried in matters.
- An add form that copied the camera page drifted from it, and tied every new camera to RTSP.

## Decision

A camera is held by Vyzio on three levels, its access, the protocols it speaks and its capabilities,
each piece of connection data in exactly one of them, and a capability is usable only once a read
proves it or the user confirms it after trying it.

- **The camera** holds its name, its address and its account. Vyzio's database is the source of
  truth for cameras; the generated configuration derives from it (ADR-02). A camera is created from
  its access alone, before any check, with no port, protocol, stream or brand; its page sets it up,
  new or not, and detection runs from there. A camera whose stream never worked stays out of the
  generated configuration (ADR-02, CAM-04).
- **A protocol** is one record per protocol the camera speaks: how to reach it (its port, empty for
  the protocol's usual one; its endpoint when the device must be asked for it; its device number
  where the protocol addresses the device by one, ADR-06), an optional account that overrides the
  camera's for this protocol alone, and the result of its last check. Every client asks for the
  account of the protocol it speaks; none reads the camera's directly. A protocol is added only by a
  check or by the user; after detection, one that could not be reached, that no capability uses and
  that holds nothing the user entered is dropped; one a capability goes through is never removed.
- **A capability** is one binding per camera and capability, video stream included (its streams:
  ADR-07). It names one of the camera's protocols and carries only its own settings. The hardware
  cut binding means the hardware cut alone; the software stop needs none (ADR-10). Capabilities are
  resolved by capability and protocol through a registry of providers, never by brand, and one
  protocol may serve several capabilities.
- **The protocol layer stands apart.** A protocol client is transport only, shared by every
  provider, holding no capability state. The set of protocols names network protocols only, never
  a strategy (ADR-10).
- **Two checks, two contracts.** The protocol check reaches the protocol, then logs in once with its
  account: never a guessed account, never a login on a protocol that did not answer; within one
  gesture each protocol is checked once. The capability check runs only once its protocol answered,
  and returns a proof outcome: proven, missing, or unprovable; failing to talk to the camera fails
  the check with its reason. A login is never a proof, and a proof never moves the camera nor leaves
  it changed (the one write allowed is undone within the probe, ADR-09).
- **One state per capability**, from its last check or the user's answer; only a verified one is
  usable. Unprovable gives "to confirm", unless the user already answered over this protocol. The
  answer is stored on the binding with its date, kept across checks, cleared by a change of
  protocol, and outranked by a proof. The user confirms by a try, a real use they start, never a
  probe: refused in privacy mode, and over PTZ it forgets the counted position (ADR-09).
- **One detection for every camera.** Each capability has one fixed protocol order, the same for
  every camera, proprietary protocols first; the stream has its own, the standard transport first.
  Detection checks each protocol once, tries a capability only on the protocols that answered, and
  keeps the first that proves it or leaves it to confirm; failing both, it drops it. A protocol the
  user chose by hand, among the camera's own protocols, answering or not, is never overridden; a
  "no" is replaced only by a proof; removing a capability forgets the answer.
- **The ONVIF endpoint is asked of the camera.** Only the device entry point is searched; every
  other service address is read from the device's answer, and a service without one is reached at
  the device entry. The search asks only what the standard leaves unauthenticated, and presents the
  account only where the camera demands it. The result is stored on the protocol, forgotten and
  asked again at each detection and protocol search. Discovery asks the same question (ADR-05).
- **A command that fails says which way**: refused by the camera (an error, a fault, a malformed
  answer) or the camera unreachable, each its own error kind at the API boundary (UI-01). Silence
  within a short wait counts as success: budget cameras act on receipt and answer late.
- **The vendor is a help hint.** It only selects a help sheet: no preset, no supported level, no
  detection decision, never stored on the camera. It is named automatically only from an answer
  that its proprietary protocol alone gives without an account (ADR-05); otherwise the user picks it
  to read the sheet (CAM-38).
- **Accounts are stored in clear** in Vyzio's database, and copied to the generated configuration,
  which needs them to open the streams.

## Consequences

- ✅ A maker speaking a known protocol needs no code; an unrecognised camera reaches every
  capability its hardware has, through the same detection
- ✅ Each connection detail has one home and one place on screen; a DVRIP-only camera and an RTSP
  camera take the same path
- ✅ A silent protocol or a refused account costs one check per gesture, and is named on the protocol
- ✅ No capability is claimed without an observation, and none that no read can show is locked out
- ✅ One screen sets up a camera, so a change to the model is made once
- ⚠️ Cameras that prove nothing keep their capabilities to confirm until the user tries them; one
  without the hardware shows a card to confirm until the user answers "no"
- ⚠️ A confirmed capability rests on the user's observation; a later proof replaces it
- ⚠️ A protocol chosen by hand that stops working stays until the user changes it: never surprise
  the user rather than guess
- ⚠️ A camera exists before it works, so its "to set up" state must read clearly (CAM-04)
- ⚠️ Each check logs in once per protocol: a camera that locks its account sees one attempt per
  gesture, never a burst
- ⚠️ A sleeping battery camera answers no protocol; its capabilities fail until it is woken
- ⚠️ Whoever reads Vyzio's data volume reads the camera accounts

## Options rejected

| Option | Why rejected |
| --- | --- |
| One adapter per brand, typed or not, with ad hoc fields for an unknown one | Locks out every unrecognised camera, and each new capability needs new fields |
| Vendor presets, with a preset path in detection | Steer detection on a guess, keep two paths, apply to no new camera; the order they carried is a property of the protocol |
| Detection resetting a protocol chosen by hand | Silently undid a working manual choice |
| Strategies (parking, software only) among the protocols | No longer answers "which protocols does this camera speak" |
| The stream kept outside the capabilities | Forked adding, checking and discovery on the transport |
| Reach data as JSON on the camera, or in each binding's settings | A record with a lifecycle hidden in one column, or one device fact copied per capability |
| A protocol check that stops at reach | Reads "answers" while every capability fails on the account |
| A manual choice among every protocol, creating the record on the side | Offers a protocol the camera cannot honour, and a record the user never added |
| A default transport for a camera without a stream binding | A disguised value: a DVRIP camera would read as RTSP and fail |
| The provider's probe as the proof | A login verified a fixed-lens camera as PTZ |
| Failing whatever cannot be proven | A head that turns would stay unusable, against CAM-11 |
| A test move as the proof | Moves a camera someone may be watching, and can undo a privacy parking |
| Forgetting the user's "no" at the next check | The user would answer the same "no" after every detection |
| A fixed ONVIF port and path convention, or a corrected port for one brand | Wrong for the next firmware, and a brand inside a protocol client |
| The ONVIF port as a user setting | Asks a non-technical owner to know what ONVIF is (principle 5) |
| Awaiting every command in full | Every step of a slow camera would wait seconds |
| A refusal named by its HTTP status | A proxy answers the same status when the API is down |
| An add form aligned on the page, or a wizard | Two flows to keep in step, a draft camera to hold |
| Checking the connection before creating the camera, or requiring an RTSP path | Refused cameras the page could have helped with |
| Discovery handing its findings to the new camera | Findings made without the account, and a second path beside detection |
| A brand selector, a stored vendor, or an "officially supported" level | Steered detection on a declaration; a brand guarantees nothing a proof does not show |
