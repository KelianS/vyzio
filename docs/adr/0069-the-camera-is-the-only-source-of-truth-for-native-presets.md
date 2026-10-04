# ADR-69: The camera is the only source of truth for native presets, slot N is its preset N

> Status: Accepted
>
> Amends [ADR-25](0025-ptz-position-management-native-presets-branch-a-vs-vyzio-managed-positions-branch-b.md)
> over ONVIF on how native presets are detected (a non-empty preset list) and, on the native tier, on
> what Vyzio keeps of a position (its record of each slot and the native token),
> [ADR-64](0064-dvrip-native-presets-detected-by-storing-then-clearing-a-spare-slot.md) on its rejected
> option 1 (the non-empty list standing over ONVIF) and its point b) (the one write a probe may make),
> [ADR-66](0066-a-capability-is-proven-by-a-read-or-confirmed-by-the-user-after-a-try.md) on its point
> b) (the DVRIP preset probe as the one write a proof may make), and
> [ADR-57](0057-privacy-parking-goes-to-the-parking-slot-and-back-to-surveillance.md) on its point c)
> (a position counts as saved when Vyzio holds its row).

## Context

A camera whose positions are stored in the camera itself shows them as empty slots on the PTZ panel
(#142). Vyzio counts the camera's presets at probe time, only to choose the tier of ADR-59, and never
lists them: a slot counts as saved only when Vyzio holds a row for it, written when the position was
saved from Vyzio. A position saved in the vendor app, or before Vyzio was installed, reaches neither
the panel nor the privacy parking prerequisite of ADR-57, and tapping its slot offers to save the
current view over it.

Over ONVIF the native tier also needs at least one preset to exist. A camera that can store presets
but holds none yet stays on the positions Vyzio counts (ADR-60), less exact than the camera's own,
and moves to the native tier at the next probe after one is saved, which strands the positions saved
in between on the other tier (ADR-64 consequences).

ADR-64 already gives DVRIP the target: the camera keeps exact presets, numbered, listed on request.
Both protocols let the caller name the preset it stores: an ONVIF `SetPreset` may carry the token,
and DVRIP stores a preset on the id it is given. An ONVIF camera may also refuse a token it did not
assign, and a list read alone does not show it. A vendor app that offers presets numbers them too.

## Options compared

1. **Keep Vyzio's rows as the record of the native positions**, and import the camera's presets once.
   Two copies that drift as soon as the vendor app saves or deletes one.
2. **Read the camera's presets and map them to the slots by their order in the list.** The order
   shifts when a preset is deleted, so a slot would change position without anyone moving it.
3. **Read the camera's presets and map them by name.** Names are free text, absent on DVRIP, and the
   vendor app lets the user rename them.
4. **Read the camera's presets; slot N is the camera's preset N.** Chosen.

## Decision

**a) On the native tier, the camera is the only source of truth for the positions.** Vyzio reads the
camera's presets whenever it needs to know which slots are held, orders the camera to store one when
the user saves a slot, and asks it to go there when the user taps one. It keeps no record that a slot
is held.

**b) Slot N is the camera's preset N**: the preset token is the slot number, over ONVIF and over
DVRIP, so a slot keeps the numbering of a vendor app that offers presets. Never the position in the
list, never the name. A camera that refuses to store a preset under its slot's number fails the save
with its reason (SPECS 1.5); a preset whose token is not a slot number is ignored, like those of e).

**c) Vyzio keeps only what the camera cannot**: each slot's thumbnail, and the free labels of the
slots the user names (SPECS 9.3). The labels of the fixed slots stay Vyzio's, and the camera's own
preset names are not read. When Vyzio reads a slot empty, it drops that slot's thumbnail and free
label, so neither comes back over another view the vendor app saves there later.

**d) A slot the camera holds without a thumbnail is a held slot**, never an empty one: a tap moves
the camera there and captures the thumbnail on arrival, like any move to a saved position. Saving
over a held slot asks first, whatever the thumbnail.

**e) Presets beyond the slots of SPECS 9.3 are ignored**: neither shown nor moved to, and Vyzio clears
none of them, apart from the spare slot its own probes store and clear (point f and ADR-64).

**f) Over ONVIF, the native tier holds as soon as the camera can store presets, even with none
saved.** The ONVIF probe proves it with the spare-slot test of ADR-64 a), the preset stored under a
token Vyzio picks. This proves both that the camera keeps presets and that it keeps them under a
number Vyzio picks, so a camera that passes never meets the refusal of b) on a slot. Any other
outcome leaves the camera on the positions Vyzio manages, where its positions can always be saved.
This write weighs only on the tier, never on whether PTZ is verified, which ADR-66 settles over ONVIF
without it.

**g) A held slot is what the camera answers now.** The panel and the privacy parking prerequisite
(ADR-57) both read the camera. When it does not answer, they say the positions could not be read,
never that they are missing, with the failed-read pattern of SPECS 1.5, and the panel offers no slot
whose state is unknown.

## Options rejected

- **Vyzio's rows as the record** (option 1, ADR-25 and ADR-57 c)). Rejected: a position saved or
  deleted in the vendor app would be wrong in Vyzio until someone saved it again, and two sources
  disagree silently (principle 4).
- **Map by list order** (option 2). Rejected: deleting preset 1 in the vendor app would shift
  Parking onto Surveillance.
- **Map by name** (option 3). Rejected: DVRIP presets carry no name, and an ONVIF name is whatever the
  vendor app or the user typed.
- **Keep the non-empty list as the ONVIF criterion** (ADR-25). Rejected: a camera that can store
  presets would count its first positions in motion time and lose them once a preset exists.
- **A read as the ONVIF proof**: the preset list answering, empty or not, and the PTZ node reporting
  room for presets. Rejected: a camera may answer both and still refuse a preset under a number Vyzio
  picks, which would leave it on a native tier where no save succeeds and with no way back to the
  positions Vyzio manages (principle 5).

## Consequences

- A position saved in the vendor app shows on its slot, held, and the privacy parking prerequisite
  counts it; one deleted there reads as an empty slot, and its thumbnail and label are dropped.
- A position moved in the vendor app keeps its old thumbnail until the next tap refreshes it.
- Every read of the slots costs a round trip to the camera, and the panel and the privacy screen
  depend on the camera answering; an offline camera already suspends its PTZ controls (SPECS 2.2).
- ONVIF cameras that can store presets but held none now take the native tier at their next probe;
  positions they had counted read as not saved, as ADR-64 describes for a tier change.
- Each probe of an ONVIF PTZ binding stores and removes one preset on the camera, as over DVRIP. A
  cleanup that fails leaves at most one preset on a slot Vyzio ignores.
- The tests of both protocols replay the captured exchanges of #92, an empty list and a held slot
  without thumbnail included.
