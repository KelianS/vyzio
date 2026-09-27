# ADR-58: A person's alert mode and cameras filter notifications, not recognition

> Status: Accepted
>
> Supersedes [ADR-15](0015-profile-camera-association-join-table-and-filtering-in-profilerulesservice.md)
> on where the profile-camera filter applies. Its join table stays.

## Context

ADR-15 restricts **recognition** by camera: outside the cameras linked to a person, a detection is not
mapped to that person's profile. The need behind it, as SPECS §4 states it, is different: not to
be alerted about the people of the house where their presence is normal. Filtering recognition serves
that need badly:

- the history loses the person's name on the other cameras, although knowing who passed costs
  nothing and stays local;
- the notifications do not change at all: the sender tells a known face from an unknown one by the
  Frigate identity, which the filter never touches.

A person's alert mode ("Me prévenir" or "Ne rien signaler") has the same gap: it is stored on the
profile, and nothing on the notification path reads it.

Frigate's face library is global (ADR-15, still true), so any per-person rule is Vyzio's to apply.

## Decision

**a) Recognition is whole.** A detection whose identity names a profile is mapped to that profile on
every camera. The history always names the person.

**b) The notification sender applies the person's policy once, before any channel.** When the
detection's identity names a profile:

- alert mode "Ne rien signaler" (`never`): no channel is notified;
- otherwise, if the person has linked cameras, only a detection on one of them is notified. A camera
  Vyzio no longer knows is not among them;
- a person with no linked camera is notified on every camera, including one added later.

A detection with no identity, or an identity naming no profile, is untouched by this step. The
channel filters (labels, hours, confidence, cooldown) apply afterwards.

**c) Ticking every camera is a fixed list.** Only an empty list means every camera; the Caméras tab
says so in its lede.

**d) The alert mode is a closed set,** `always` and `never`, the values the dashboard sends.

## Options rejected

- **Keep filtering recognition (ADR-15).** It degrades the history without silencing a single
  notification.
- **Drop the detection upstream,** before it reaches the history or the sender. Silences the person,
  but leaves an unexplained gap in the history (principle 4) for no gain, since recognition is global
  in Frigate anyway.
- **Treat a list of every camera as "every camera".** A deliberate list could no longer be frozen, and
  the stored links would mean something different from what they hold.
- **Apply the policy inside each channel.** The same rule would be evaluated per channel for a result
  that does not depend on the channel.

## Consequences

- Profiles created before this decision with an alert mode outside `always` and `never` are not
  migrated (a single instance, migrations restart before release).
- The history shows a person's name on every camera, including those they are not signalled on.
- The Caméras tab of a person speaks of alerts, not of recognition.
