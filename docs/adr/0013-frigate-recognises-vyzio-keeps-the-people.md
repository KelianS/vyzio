# ADR-13: Frigate recognises faces; Vyzio keeps the people, their photos and their notification policy

## Context

Vyzio names the people of the house in its detections (DET-02), from photos the owner gives
(UC-PROF-01, PROF-02), and the owner decides whether and where a person is notified (UC-PROF-02,
PROF-03, PROF-04). The need behind a person's cameras is not to be alerted where their presence is
normal, not to stop knowing who passed.

Frigate (ADR-02) recognises faces natively, from a face library it keeps by person name, and reports
the recognised name as the detection's identity. Its library is global: it cannot limit a person to
some cameras, so any per-person rule is Vyzio's to apply. Reference photos are personal data the user
must keep control of; the biometric data computed from them are more sensitive still.

## Decision

Frigate recognises; Vyzio keeps the canonical copy of each person's photos, feeds Frigate's library
from it, and applies the person's notification policy itself.

- Vyzio runs no recognition of its own, no worker and no extra container; the recognition models
  ship with Vyzio (ADR-03).
- Vyzio stores each reference photo and syncs it into Frigate's library through Frigate's API on
  every addition, removal and rename, never by writing into Frigate's storage. Each photo records
  whether it is in the library, and the whole library can be rebuilt from Vyzio's copies after
  Frigate is reset.
- A person is known to Frigate by their name; a detection's identity resolves to a person when it is
  read (ADR-12), and a rename re-syncs the person's photos under the new name.
- Biometric data stay in Frigate: Vyzio never stores, reads or transmits them, and no notification
  carries any (ADR-14).
- Recognition is whole: a detection whose identity names a person names them on every camera, the
  history included.
- The notification sender applies the person's policy once, before any channel (ADR-14):
  - the alert mode is a closed set, signalled or never signalled;
  - a person with linked cameras is notified only on them, and a camera Vyzio no longer knows is not
    among them;
  - a person with none is notified on every camera, including one added later; ticking every camera
    is a fixed list;
  - a detection with no identity, or one naming no person, passes this step untouched; the channel's
    own filters and the muting rules (ADR-15) apply afterwards.
- A person's cameras are a relation of their own, person to camera, removed with either side.

## Consequences

- ✅ No second AI pipeline to build, run and update: one container and one failure surface fewer.
- ✅ The photos stay under the user's control, deletable from Vyzio, and survive a reset of the engine.
- ✅ The history always knows who passed, even where the person is not notified.
- ✅ The person's policy is evaluated once per detection, whatever the number of channels.
- ⚠️ Each photo is stored twice, by Vyzio and by Frigate: small, photos and not video.
- ⚠️ Recognition quality and its evolution follow Frigate's.
- ⚠️ The name is the key in Frigate's library: a rename that fails to re-sync leaves the person
  unrecognised under the new name.
- ⚠️ A photo that failed to sync is not used for recognition until it is synced again; the screen
  shows each photo's state.

## Options rejected

| Option | Why rejected |
| --- | --- |
| A mandatory recognition worker in Python, behind a local typed contract | Duplicates a mature Frigate feature; one more container, a contract to maintain and a lasting maintenance debt |
| Frigate by default, an optional worker for advanced needs | Two modes to govern for no current need |
| Write the photos straight into Frigate's storage | Coupled to its internal layout, and the photos fall under Frigate's control |
| Send the photos to Frigate without keeping a copy | A reset of Frigate loses them, and Vyzio has no source of truth to rebuild from |
| Limit recognition per camera | Degrades the history without silencing a single notification, since the sender reads Frigate's identity |
| Drop the detection upstream where the person is not notified | An unexplained gap in the history (principle 4), for no gain |
| Treat a list of every camera as "every camera" | A deliberate list could no longer be frozen, and the stored links would mean something else than they hold |
| Apply the person's policy inside each channel | The same rule evaluated per channel, for a result that does not depend on the channel |
| A person's cameras stored as a list on the person or on the camera | Cannot be queried both ways, and does not cascade when either side is removed |
