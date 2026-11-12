# ADR-15: A setting is an installation value a camera may override, declared once, saved without restarting the engine

## Context

Settings keep growing (retention, detection, privacy, notifications, schedules), and a setting that
brings its own storage, its own form and its own way of being saved multiplies them. Four forces
shape them.

- Disk space is shared by the whole installation, yet two cameras rarely serve the same use: a value
  must hold for the installation and still be changeable for one camera (HIST-06, UI-08).
- Two settings of the same nature must look and behave the same everywhere (UI-18), and a written
  charter alone does not keep each new screen from drifting.
- What happens at what time in the house (cutting cameras, silencing channels) is the same need for
  each kind of target: a range that may target several things, without repeating a table, its
  validation, a scheduler and a form for each kind (SCHED-01).
- The detection engine reads its generated configuration (ADR-02) only when it restarts, and a
  restart interrupts surveillance. When it happens is the user's choice (UI-12, UI-13), and a
  restart that fails must not pass for a success (UI-17).

## Decision

A setting has an installation value that a camera may override, is declared as data that the
interface renders, is saved without effect on the engine, and reaches the engine only through a
global restart the user triggers.

- **Installation value, camera override.** Each domain has one typed installation table holding a
  single row, created with the shipped values when absent; never a generic key and value table, which
  would give up typing and type-safe comparison (COMMON-04). The camera carries nullable overrides,
  and null means "follow the installation", never a disguised value. The resolution of override over
  installation has one point in the core, shared by config generation and the API boundary; no layer
  reimplements it.
- **Override per setting, never in a block.** A camera that sets one value keeps the others attached
  to the installation. The value one level up travels to the API boundary, so undoing an override
  names what it restores. The installation level works the same way against the shipped value.
- **The generated configuration mirrors the model.** The installation value is written once for the
  engine, and only what a camera really overrides appears under that camera (ADR-02).
- **A setting is declared, not drawn.** A declaration states the name, the nature of the value, its
  options, unit, help, consequence and scope; the settings renderer derives the control, the layout,
  the provenance and the undo. The nature alone picks the control, from a closed table the renderer
  holds; one fact has one control. A hand-drawn setting is an exception justified in review, and a
  setting that fits no nature extends the table before its screen is written.
- **A scheduled rule is a type, a set of targets and one weekly range**, in the installation's clock.
  The type declares its target kind (privacy targets cameras, muting targets notification channels).
  A target is an identifier read in that kind, with no foreign key: a removed camera simply stops
  being targeted, and a rule left without target stays until edited or deleted. A rule is deleted,
  never paused. The server is the source of the current moment in the installation's clock.
- **One consumer per rule type.** A target is under a type's effect when any rule of that type
  covering the moment targets it. Adding a type is a type value, its target kind, its consumer and
  its wording; the rule storage, the API, the calendar and the range editor do not change. A camera
  keeps its privacy strategy and manual toggle (ADR-10), a channel what it notifies (ADR-14); neither
  holds a range.
- **Saving persists, nothing more.** It is immediate, and never touches the
  running engine. An action (checking a connection, removing a camera, cutting surveillance) is not
  a setting: it acts at once and never waits for the restart.
- **Restarting is one explicit, global act.** Any number of saves on any number of pages are taken
  up by a single restart the user triggers. The pending state records which settings wait, fed only
  by the writes that actually change the engine configuration: a setting that writes nothing for the
  engine, or a save that changes nothing, cannot raise it.
- **A failed restart is a persistent failure signal.** The saved settings stay the reference; the
  pending state survives until a restart succeeds, and the failure reads as a breakdown with a retry.

## Consequences

- ✅ A new overridable setting costs a nullable column and a declaration: provenance, undo and
  alignment come with it.
- ✅ Vyzio describes its settings in the engine's own shape (a root value overridden per camera), so
  nothing is translated twice.
- ✅ A new rule type costs no screen and no table; a new target kind costs a list of options.
- ✅ The user chooses when cameras stop seeing, and restarts once for many changes; no queue and no
  background service exist to merge restarts.
- ✅ Cutting a camera never waits on a deferred restart: it is an action (ADR-10).
- ⚠️ The engine and Vyzio may diverge for as long as the user leaves the restart pending; the
  divergence is shown, never forced.
- ⚠️ Recording which settings wait makes each setting identifiable to the application layer, not
  only to the interface that declares it.
- ⚠️ Every settings screen carries a draft, a shared component of the interface foundation (ADR-01),
  never rebuilt per screen.
- ⚠️ The privacy scheduler switches the targeted cameras one by one; grouping them into one reload
  (PRIV-14) is outside this decision.

## Options rejected

| Option | Why rejected |
| --- | --- |
| One installation value only | Imposes one duration on cameras whose uses differ: a constraint from Vyzio, not from the need. |
| Per-camera settings only | Disk is shared, so the user cannot reason on the installation; six cameras mean six identical settings by hand. |
| A generic key and value settings table | Gives up typing, hence type-safe comparisons. |
| A "this camera decides everything" switch | Freezes the other values at their current level without saying so. |
| A written charter applied in review | It was the arrangement in place, and the screens drifted anyway. |
| One free component per setting, reviewed | Leaves the freedom whole; only the moment the drift is seen changes. |
| The screen author chooses the control | Two settings of one nature render differently on two pages. |
| One schedule per entity, a table per type | A range cannot target several things, and each type repeats table, validation, loop and form. |
| A generic automation engine | Complex automations are out of scope (SPECS § Hors perimetre), and this audience reads a week, not a rule language. |
| A notification range as an allowed window | The inverse of a privacy range: one calendar would show two opposite readings. |
| Saving on leaving a field, no button | Keeps three states, hides what changed, and makes each keystroke costly when it touches the engine. |
| Save and apply as two per-change steps | Exposes a state with no meaning for the user, one chore per change. |
| Saving means applying, the restart merged in the background | Neither chosen nor visible, the interruption of surveillance is decided for the user; it needs a merging queue that buys only that masking. |
| A synchronous restart on every save | Interrupts surveillance at each setting and charges the installation's delay to one page. |
| The API says before saving whether a restart is needed | Saving costs nothing to announce once the restart is a separate act. |
| A single pending flag that names nothing | The user cannot tell what a restart would take up (UI-14). |
| The trigger names the domains waiting | A domain is a category of the information architecture; the user recognises a setting, not a domain. |
