# ADR-12: The history is Frigate's list, enriched on read; retention is three durations, the history's never below a day

## Context

The history shows what happened, filtered, with its clip when one exists (UC-HIST-01, HIST-03,
HIST-04), and the owner chooses how long each kind of recording is kept, for the installation and
per camera (UC-HIST-02, HIST-06, HIST-07). Frigate (ADR-02) already records, detects, keeps each
detection's clip and image, and deletes them when their retention ends.

A copy of Frigate's detections kept by Vyzio was measured to rot: about half of its rows pointed at
a media that no longer existed. The copied "has a clip" and "has an image" flags were true at the end
of a detection and false once the media expired, and Frigate drops, object by object, the detections
it keeps no media for. The same question, "which media does this detection have", got a different
answer from each consumer. Once each fact was given its owner, the copy held nothing Vyzio owned.

Retention is first a question of disk, a resource the whole installation shares, while cameras serve
unlike uses. Frigate counts three kinds of recording apart, each with its own duration: the full
video, the moments with motion, and the clips tied to a detection. The last one is what the history
can show: a zero there does not make a short history, it makes none.

## Decision

Frigate holds every detection, its media and their lifetime; Vyzio persists no detection, reads
Frigate's list when the history is read, enriches it, and keeps only the facts it alone produces.

- One owner per fact:

  | Fact | Owner | What Vyzio does |
  | --- | --- | --- |
  | A detection's camera, kind, score, time and identity | Frigate | Reads them at each history read, never copies them |
  | Whether a clip or an image exists, and until when | Frigate | Asks when the answer is used, once per history page, never per row |
  | The person an identity names, the camera's display name | Vyzio | Resolved at read time, never frozen at detection time |
  | A notification sent: channel, outcome, deduplication | Vyzio | Its notification log, anchored on Frigate's detection identifier |

- An identity the user corrects is written into Frigate, never kept by Vyzio (UC-DET-02).
- The detection event feed persists nothing: it hands the detection to the notification sender
  (ADR-14) and returns at once.
- Clips and images reach the screen only through the API, authenticated, streamed without buffering
  a whole file, and seekable; the screen never addresses Frigate (ADR-02).
- Each detection has two images by role: cropped on the object for the history list, the wide shot
  for a notification.
- Retention is three durations, full video, motion and detection clips, each an installation value a
  camera may override (ADR-15). Vyzio decides them and writes them into the configuration it
  generates; Frigate applies them.
- The detection clip duration is the history's depth: it also governs the detection's image and
  every severity Frigate keeps for a detection, and it never goes below one day. The floor, and a
  ceiling, are Vyzio's, enforced at the one place the effective retention is resolved.
- Full video and motion may be zero. Full video is opt-in, and whether it records is its duration,
  never a flag beside it. A camera always keeps its detection clips: keeping no new video from a
  camera is privacy mode (ADR-10), which stops new recordings and erases none.

## Consequences

- ✅ The history never offers a row with nothing behind it, and its depth is exactly what it can show.
- ✅ A renamed or deleted person, a renamed camera, show at once across the whole history.
- ✅ No copy to reconcile, no deletion rule, no repair job.
- ✅ The screen's contract does not depend on Frigate: a change of Frigate's API is translated at the
  one boundary Vyzio keeps with it.
- ✅ A new installation keeps motion and detection clips from its first day; full video stays a
  deliberate choice, the only one whose disk cost grows with time rather than with events.
- ⚠️ Frigate unreachable means no history, and the screen says so: a cache would show a surveillance
  that is not running (UC-HIST-01).
- ⚠️ The history follows Frigate's event reading, which pages by time only.
- ⚠️ An expired clip is the consequence of a setting, not a failure, and the history must say so;
  nothing of it reaches the notification path.
- ⚠️ A corrected identity reaches Frigate after a few seconds: the screen shows the correction without
  waiting to read it back.
- ⚠️ Frigate deletes on its own cleanup cycle, so a shortened duration frees the disk only later; a
  changed duration takes effect when the engine restarts (ADR-15).
- ⚠️ Retention consumes disk from the first day, which makes the storage alert (HIST-01) more needed.

## Options rejected

| Option | Why rejected |
| --- | --- |
| A table of detections trusting the flags copied at the end of each detection | Half its rows pointed at deleted media: the flags were true at one instant, never revisited |
| Keep the table and reconcile it against Frigate, at stabilisation and on read | Maintains a copy of facts Vyzio does not own, with a repair mechanism, a deletion rule and an outage case to arbitrate, to own nothing more |
| Repair the copy by a periodic sweep | Reimplements Frigate's retention calendar, at a cost growing with the table, and is wrong between sweeps |
| A history deeper than Frigate's retention | The extra depth is empty: rows with nothing to show promise what the product does not have |
| Copy the media into Vyzio | Vyzio would own the video storage and its retention, Frigate's job (ADR-02) |
| Hand the browser Frigate's media address | Frigate exposed without authentication (ADR-02) |
| Mount Frigate's media volume and serve its files | Coupled to Frigate's internal layout |
| Republish enriched detections on the bus as the internal pipeline | Renaming Frigate's feed brings nothing; a published topic is a product feature for an outside integration, and none is published (ADR-02) |
| Frigate's grouped passages as the history's items | Not taken here: it changes what the history shows, not where it gets its truth, and is a product decision of its own |
| One retention duration for the whole installation | Imposes the same duration on unlike cameras |
| Retention per camera only | Disk is shared: no installation value to reason with, and the same setting repeated on every camera (principle 5) |
| One mode, everything or motion, and one duration | Vyzio's invention over two independent counters; forbids keeping everything a day and motion a week |
| Leave detection clips at Frigate's default | An unchosen, invisible duration would govern the most visited page (principle 4) |
| Show Frigate's alert and detection severities as two durations | The engine's review model, meaningless to a non-technical user (principle 1) |
| An on or off switch per camera for full video, beside its duration | Two sources of truth for one fact; the switch was inert both ways |
| Zero allowed on detection clips, a camera that records nothing | Detect, notify and show nothing: an edge case carried through every step for an empty screen |
| Zero forbidden on all three durations | No full video is the shipped value and a deliberate choice |
| An image retention fixed apart from the clips | An image outliving its clip, or dying before it, makes the history lie about its depth |
