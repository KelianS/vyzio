# ADR-66: A capability is proven by a read, or confirmed by the user after trying it

> Status: Accepted, amended by [ADR-71](0071-the-vendor-is-a-help-hint.md) on e) (no preset path:
> detection keeps a capability to confirm on every camera, and the first candidate in priority order
> that proves it or leaves it to confirm wins)
>
> Amends [ADR-61](0061-camera-connection-data-on-three-levels-access-protocols-capabilities.md) on its
> point c) (the capability's provider probe stays the proof until #221),
> [ADR-64](0064-dvrip-native-presets-detected-by-storing-then-clearing-a-spare-slot.md) on the last clause
> of its point b) (the login alone decides whether the DVRIP PTZ capability is verified),
> [ADR-22](0022-camera-capability-catalogue-brand-protocol-decoupling-vendor-presets-manual-onboarding.md)
> on what `Verified` records (only a probe's result), and
> [ADR-28](0028-cascading-multi-protocol-capability-detection-and-the-manuallyconfigured-flag.md) on
> what the cascade keeps (the first candidate, in priority order, that proves it or leaves it to confirm).

## Context

ADR-61 split the protocol check (the camera answers on this protocol, with this account) from the
capability check, and left what proves a capability to its provider's probe. Several of those probes
prove no more than the protocol check already did (#207, #221):

- DVRIP PTZ logs in. A fixed-lens ICSee is marked PTZ verified and offered a joystick that moves
  nothing.
- Tapo KLAP PTZ and hardware cut complete the KLAP handshake.
- V380 PTZ finds the device and authenticates.

A capability verified on a login says the protocol answered twice, and claims a capability Vyzio
never observed: principle 4, and SAD § 7 (never enabled without a real test). Some protocols offer
no read that shows a capability at all, so "prove it or fail it" would either keep a working V380
head out of reach or keep claiming what was not observed.

## Options compared

| Option | Description | For | Against |
|---|---|---|---|
| **A. Keep the provider probe as the proof** | ADR-61 as it stands | Nothing to build | The defect of the context: a login verifies a capability |
| **B. A read-only proof, failing whatever cannot be proven** | Each probe reads something only the capability can answer; no read means a failure | Never claims a capability not observed | A V380 or Tapo head that works reads "En échec", with no way to make it work |
| **C. A read-only proof, and the user's confirmation where none exists** | As B, but a capability with no possible read is "à confirmer" until the user tries it and says it worked | Never claims without an observation, whoever observed it; nothing working is locked out | One more state, and one gesture for the user on those cameras |
| **D. A test move as the proof** | The probe moves the camera and reads the position back | Automatic | Moves the camera on every check, which #207 ruled out; many cameras cannot report a position anyway |

**Option C chosen.**

## Decision

**a) Two checks, two contracts.** The protocol check stays ADR-61's (`ICameraProtocolProbe`: reach,
then one login). The capability check is each capability provider's proof: it runs only once the
protocol answered, and returns a **proof outcome**, never a yes or no:

- **proven**: the camera answered a read that only the capability can answer;
- **missing**: the camera answered the read and it shows the capability is not there, with what it
  answered;
- **unprovable**: the protocol offers no such read, or none has been validated on hardware.

A failure to talk to the camera during the proof (a timeout, a refused command) is none of these: it
fails the check with its reason, as before.

**b) A login is never a proof.** A provider that has nothing to read beyond the login returns
unprovable. A proof never moves the camera and never changes its state; the one write allowed stays
the DVRIP native-preset probe of ADR-64, undone within the probe. Over DVRIP, a preset stored then
listed is the PTZ proof: a camera that keeps a PTZ preset has a motorised head. Any other outcome of
that probe is unprovable, never missing, since an ICSee that keeps no preset can still turn.

**c) A capability has one state, from its last check or the user's answer**: verified, to confirm,
missing, failed, or rejected by the user. Only verified makes it usable (the joystick, privacy
parking, the hardware cut, image settings). An unprovable outcome gives "to confirm", unless the user
already answered over this protocol: a "yes" keeps it verified, a "no" keeps it rejected by the user.
The answer is stored on the binding with its date, next to the state. It is kept across later checks,
including a camera that stopped answering for a while; it is replaced by the user's next answer,
cleared by a change of protocol, and outranked by a proof: a capability the camera proves is verified,
whatever the user answered.

**d) The user confirms by trying.** A capability to confirm offers a **try**, a real use the user
starts, which is not a probe: the head turns a little right and back, then a little down and back,
so that a head that only pans or only tilts still moves; the hardware cut closes for a few seconds,
then opens. Then it asks one plain question, and the answer is the user's: yes makes it
verified, confirmed by the user, with the date; no makes it rejected by the user, unusable, with the
way out. A capability rejected by the user offers the try again, on purpose: the same try, then the
same question, whose "yes" replaces the "no". The try is refused
while the camera is in privacy mode (it would uncover or move a camera the user covered) and suspended,
like every check, while the stream fails. A try over PTZ forgets the position Vyzio counts for that
camera (ADR-60), so the next recall homes first, and the calibration stays valid.

**e) Detection keeps the first answer in priority order.** Among the candidate protocols, taken in
their priority order (ADR-71 b), the cascade keeps the first that proves the capability or leaves it
to confirm; failing both, it drops the capability: a camera with no sign of a motorised head gets no
Orientation card to deal with, and the user adds it by hand, which then offers the try. A detection never brings
back a capability the user rejected over a candidate: it still looks for a proof on every candidate,
and only a proof replaces the "no"; otherwise the capability stays rejected on its protocol. Removing a
capability forgets the answer: added again by hand, it starts to confirm.

The screen's states, words and gestures, and the product rule, are in [SPECS](../SPECS.md) 2.3.

## Options rejected

**Keeping the provider probe as the proof (A).** It verifies a fixed-lens ICSee as PTZ because it
answers DVRIP: the claim without observation this decision removes.

**Failing whatever cannot be proven (B).** A V380 head that turns would read "En échec" forever, and
the product would take away a capability the hardware has: the opposite of SPECS 2.3.

**A test move as the proof (D).** A check that moves the camera surprises whoever is watching it and
can undo a privacy parking; #207 kept the probes read-only for that reason. The try of d) moves the
camera too, but only when the user asks, knowing it will.

**A preset list read alone as the DVRIP PTZ proof.** The generic XM firmware may answer
`Uart.PTZPreset` on a fixed lens as well; a stored and listed preset asks more of the camera, and
costs nothing more, since ADR-64 already stores one.

**Forgetting the "no" at the next check.** A fixed-lens camera would be "to confirm" again after
every detection, and the user would answer the same "no" each time. The try on purpose of d) gives the
same way back without asking twice.

**Two flags, `Verified` and a "to confirm" flag.** Two booleans hold states that exclude each other,
and a card would have to reconcile them; one state names each case once.

## Consequences

- ✅ A camera that answers a protocol but lacks a capability is never shown with it verified
- ✅ A capability no read can show stays within reach: the user tries it once and it works from then on
- ✅ Each failed card says why: the protocol, the capability missing, or the user's own "no"
- ✅ The user answers "no" once: no check or detection asks again, and the try on purpose stays there
- ⚠️ ICSee cameras that keep no preset, V380 heads and Tapo cameras prove nothing: detection keeps
  those capabilities "to confirm" until the user tries them; until
  then no joystick and no privacy parking on them
- ⚠️ A confirmed capability rests on the user's observation: its card says so, with the date, and a
  check that finds a proof later turns it into a proven one
- ⚠️ Tapo has a read for its lens cut and its motor in some firmware, not validated on hardware yet:
  both stay unprovable until one is
