# ADR-63: A scheduled rule is a type, a target set and a weekly range, planned in one calendar

> Status: Accepted
>
> Amends [ADR-09](0009-notifications-telegram-first-plus-fcm-and-alternative-channels.md) on the
> hour ranges it places in the delivery rules model, which become muting rules;
> [ADR-20](0020-privacy-mode-vendor-api-first-frigate-fallback-and-ivendorcameraadapter.md)
> on its per-camera schedule table, endpoints and evaluation, which this rule model replaces;
> [ADR-40](0040-information-architecture-viewing-apart-from-configuring-two-level-settings-tree.md)
> on its settings tree, which gains the `Horaires` rubric while `Notifications` loses its hours;
> [ADR-43](0043-settings-grammar-a-setting-is-declared-not-drawn.md) on its control table, which gains
> the time of day; [ADR-50](0050-the-messaging-channel-becomes-bidirectional-a-channel-agnostic-command-layer.md)
> and [ADR-58](0058-a-persons-cameras-filter-notifications-not-recognition.md) on the hours they
> count among a channel's shared settings and filters, which give way to muting rules.

## Context

What happens at what time in the house was scattered. Privacy ranges belonged to one camera each, so
"cut the indoor cameras in the evening" was recreated camera by camera; notification hours were one
daily window, to the hour, on each channel's settings; nothing showed the week as a whole. More
time-based rules will come ([issue #228](https://github.com/KelianS/vyzio/issues/228), owner
decision), and each would otherwise bring its own table, its own form and its own place in the
interface.

## Options

### The model

1. **Keep one schedule per entity**, a table per type (privacy ranges on cameras, hours on channels).
   Rejected: a range cannot target several things, and every new type repeats the table, the
   validation, the scheduler loop and the form.
2. **One rule model shared by every type.** A rule is a **type**, a **set of targets** and a **weekly
   range** (days of the week, a start and an end time). The type says what the targets are and what
   the range does to them. Chosen.
3. **A generic automation engine** (conditions, triggers, actions). Rejected: SPECS 12.2 keeps complex
   automations out of the MVP, and a non-technical audience (principle 1) reads a week, not a rule
   language.

### What a notification range means

4. **An allowed window** ("send only between 08:00 and 22:00"), as before. Rejected: it is the
   inverse of a privacy range, so one calendar would show two opposite readings of a range.
5. **A range during which the targeted channels send nothing** while detection and recording go on.
   Chosen: every range in the calendar then means "during this time, this effect applies".

### Where the calendar lives

6. **A new entry in the main bar.** Rejected: ADR-40 keeps the bar for viewing, and the calendar is
   where rules are created and edited.
7. **A settings rubric of its own, `Horaires`.** Chosen: the settings tree is where a new domain goes
   (ADR-40), and the rubric is reached from the camera and the channel that a rule targets.

## Decision

**A scheduled rule is a type, a target set and one weekly range.**

- `ScheduleRule` holds the type and the range, in the installation's clock; `ScheduleRuleTarget` holds
  its targets. The range follows the rules of [SPECS](../SPECS.md) 7.3 (crossing midnight, refusals
  saying what to change). A rule is deleted, never paused.
- **The type declares its target kind.** `Privacy` targets cameras; `MuteNotifications` targets
  notification channels. A target is an identifier read in the kind its type declares, so it carries
  no foreign key: a camera removed later simply stops being targeted, and a rule left with no target
  stays, doing nothing, until it is edited or deleted.
- **Each type has one consumer that reads the rules**, and a target is under a type's effect when any
  rule of that type covering the moment targets it (the union). The privacy scheduler cuts and
  restores the targeted cameras, with the manual priority of ADR-20 unchanged. The notification
  sender skips a channel that a `MuteNotifications` rule covers at the time of the detection: the
  notification is dropped, not delayed, and the detection stays in the history. Only detection
  notifications are concerned; replies to channel commands are not.

**Adding a type** is an enum value, its target kind, the consumer that reads it, and its wording in
the interface. The rule table, the API, the calendar and the range editor do not change.

**What a camera and a channel still own.** The camera keeps its privacy strategy (what it does in
privacy mode, SPECS 9.3) and the manual privacy toggle; the channel keeps what it notifies
(categories, certainty, spacing) and how. Neither holds a range any more: each shows how many rules
apply to it, with the way to the calendar.

**The calendar is the `Horaires` settings rubric**, a week and one range editor serving every type.
The editor's fields are declared settings (ADR-43): an existing rule follows the editing cycle of
ADR-41, and a new one is added by its own button, like a person or a camera. How the two screens
read is the DESIGN SYSTEM's (§ Calendar and range editor).

**ADR-43 gains the `time` nature**: a time of day, drawn as a time field.

## Consequences

- The per-camera schedule table and the channel's hour columns disappear. On the single instance
  there is no data migration: existing ranges are recreated in the calendar.
- A rule can target several cameras or channels; "every camera" is a list of the cameras chosen at
  that time, never a promise about cameras added later, as for a person's cameras (ADR-58).
- The scheduler still switches cameras one by one; grouping a rule's cameras into one reload
  (SPECS 9.2, last rule) is outside this decision.
- A new rule type costs no screen, and a new target kind costs a list of options in the editor.
