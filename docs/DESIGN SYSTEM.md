# Dashboard Design System

The dashboard's design system: intent, tokens, components, the patterns every screen reuses, the
shared UX vocabulary and the bans. It never describes one feature's behaviour, which is
[SPECS](SPECS.md), its use cases, or the code and its tests, and never paraphrases the code
([DOCS-11, DOCS-13](rules/docs.md)). The French labels quoted are the product's own copy,
reproduced verbatim.

## Intent

The Vyzio Hub must feel calm, readable and domestic, never like an expert NVR tool: a dark, quiet
interface where the cameras come first, their state reads at a glance from one mark, each view has
one main action, and everything else stays neutral. Rare settings fold in place under `Avancé`,
out of the everyday path and never naming the engine underneath (product principle 2). Less is the
default: a word, a subtitle or a frame is added only when it carries something the user acts on.

## Palette

**Dark only.** One theme, its colours held by roles, never by colours
written in a screen. Each role is a token; the Tailwind theme realises them, and no component writes
a colour.

| Role        | Value                  | Use                                                                                |
| ----------- | ---------------------- | ---------------------------------------------------------------------------------- |
| Ground      | `#101412`              | The page background                                                                |
| Surface     | `#1b201d`              | A card, a grouped list, a sheet                                                    |
| Raised      | `#242a26`              | A neutral pill or button on a surface, a pressed or selected row                   |
| Icon circle | `#2a312d`              | The round background of an icon button and of a row's icon                         |
| Line        | `#2c332f`              | The separator between rows, every border that names no other                       |
| Field line  | `#3a433d`              | The border of a field                                                              |
| Ink         | `#eef2ef`              | Primary text                                                                       |
| Ink soft    | `#9aa59e`              | Secondary text, a subtitle, a section label                                        |
| Ink muted   | `#c9d1cb`              | Text over the picture or inside the bar, a value's open lock; a step below the ink |
| Bar         | `#1d4a3a`              | The top bar                                                                        |
| Action      | `#7fd1a8` on `#0e2a1f` | The one main action of a view, and the "running" mark                              |
| Silence     | `#f2c46d` on `#2b1f05` | Silence only                                                                       |
| Alert       | `#f29a8b`              | Offline, a failure, a warning, a destructive action                                |
| Mark off    | `#6f7a73`              | The "cut" and "not verified" mark                                                  |

Colour roles, each with one meaning:

- **Green** is the one main action of a view and the "running" state; never a second action, never a
  decoration.
- **Amber** is Silence and nothing else.
- **Coral** is offline, a failure and a warning, and the ink of a destructive action.
- **Neutral grey** is everything else: icon circles, secondary actions, folds, selected rows.
- Colour never carries a meaning alone: a state also reads from its mark's shape (§ Status mark), a
  kind of thing from its icon and its name.

## Typography

**One family, Inter, self-hosted**: the hub works offline, so no font is fetched from the network.
**Four sizes**, never a fifth:

| Size   | Role                                                           | Weight                                    |
| ------ | -------------------------------------------------------------- | ----------------------------------------- |
| `26px` | Page title                                                     | Bold, tracked slightly tighter            |
| `17px` | Row or card title, a field's value                             | Semibold for a title, regular for a value |
| `15px` | Secondary text, a button label, a subtitle                     | Regular; semibold on a button             |
| `13px` | Section label above a grouped list, a caption over the picture | Semibold, ink soft                        |

Two levels are told apart by size, weight and colour together: one signal alone does not separate a
title from its subtitle.

## Interface tokens

Radii, three shapes never confused (exact values in `src/index.css`, the single home):

| Shape             | Use                                                                 |
| ----------------- | ------------------------------------------------------------------- |
| Pill (`999px`)    | Every button, every pill, every tab                                 |
| Circle            | An icon button, a row's icon, a status mark, a day toggle           |
| Rounded rectangle | A surface (card, grouped list, sheet), a field, the picture's frame |

**A control is a finger's size**: every control reaches `44px` to the touch, a list row is drawn at
least `56px` tall, an icon button `44px` round. A control never relies on an invisible margin to
reach it on a phone.

**One surface.** A card, a grouped list or a sheet is drawn by one shared component, never rewritten
in a screen: the surface colour, its radius, no border, no shadow; rows inside are split by a line.
Sections are spaced `24px` apart, a section label `8px` above its list.

## Component foundation

Two tiers, never confused ([ADR-01](adr/0001-stack-and-runtime.md)):

- **Primitives**: shadcn/ui code copied into the repository (accessibility, focus, keyboard), modified
  **only** for the theme, never with a business rule inside, outside the project's writing discipline.
- **Vyzio components**, built **on top of** the primitives, carry the product vocabulary (the top
  bar, a grouped list and its rows, the status mark, a setting field and its lock, a sheet):
  the project's code discipline applies there.

**The tokens are the source; the Tailwind theme is their realisation.** One styling system, Tailwind
plus tokens: no global class, no literal colour, radius, size or shadow in a component. Responsive
design follows the library's scale from the phone upwards; a larger screen develops the same
structure ([SPECS](SPECS.md) UI-10).

**Icons are line icons**, from the one icon set, never an emoji: its glyph and colours change with
the phone, and it reads as another product beside the line icons.
A detection's type reads at a glance from its icon, in a small icon circle before a clip's name,
wherever a clip is listed or played and in the filter; one table maps each type to its icon.

**A press never selects.** What the user acts on, a button, a link, a tab, a row, a field's label or
a strip of controls marked `data-press-only`, never selects its text nor opens the phone's callout on
a long press; text to read stays selectable, and so does a field. One base rule in `src/index.css`
carries it, never a class per component.

## Motion

Motion is calm and physical, the feel of a quiet, well-made phone app: it answers a gesture at once,
follows the finger, and bridges a change that would otherwise jump; it never decorates. **Every
movement is a spring**, never a curve and a duration. Its values live in the one motion module of
the code (`common/motion`), never in a component nor in this document; the spring engine is
[ADR-01](adr/0001-stack-and-runtime.md)'s.

| Token             | Use                                                                                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Response          | How quickly a spring reaches its target: one for what moves, a quicker one for a control sinking under a press                                                                               |
| Arrival damping   | **What arrives** lands with a light bounce: a page opening, a sheet or a toast rising, a tab landing, the bar growing, a control released after a press, a dragged layer coming back to rest |
| Departure damping | **What leaves** settles without a bounce: a layer closing, going back, a toast or an alert dismissed, the bar giving its room back                                                           |

- **Interruptible.** A spring starts from the value on screen and keeps its velocity: a motion caught
  by a tap or a finger goes on from where it is, never jumps nor restarts.
- **The finger leads.** What a finger drags follows it one to one. A drag starts only once its
  direction is clear, so a scroll is never taken for a swipe, and a drag that starts on a control (a
  steering pad, a slider, a button, a field) belongs to that control. Past an end, the finger meets a
  rubber band that grows harder to pull. These gestures answer touch only: with a mouse, on a large
  screen, the same layers move by their buttons.
- **Momentum decides.** A released gesture lands where its momentum projects it: the projected end,
  not the point of release, decides whether it completes or comes back.
- **Transform and opacity only**, so nothing lays the page out again while it moves.
- **Every press answers on pointer-down**, so a tap never looks unheard while the answer is on its
  way. Every press is taken by a slot, never by a class on a screen.
  - A **control** (a button, a pill, an icon button, a control over the picture) sinks slightly, then
    springs back on release: the button primitive takes it by its slot, any other control is wrapped
    in the shared pressable control.
  - A **surface that leads somewhere** (a row, a card, a camera's picture) dims while pressed and
    never moves; it is wrapped in the shared pressable surface or is the registry `item`.
- **The primitives' small layers** (a popover, a select, a tooltip) and a **confirmation** keep a
  short fade with a slight growth, on the one calm curve of `src/index.css`: they ask, they do not
  move anything the user holds.
- **Reduce motion.** When the phone asks for less motion, movements turn brief and bounce-free, or
  fades: never a slide, a stretch or a bounce. A page and a tab fade in place, a sheet and a toast
  fade, an end gives no rubber band, and a press dims instead of sinking. What the finger holds still
  follows it. A spinner keeps turning: it is the only sign that work goes on.

## Patterns

### Top bar

The shell is **one top bar, anchored at the top, its bottom corners rounded, on the bar colour; there
is no navigation bar** ([SPECS](SPECS.md) UI-29).

- What it carries on the home and on an inner page is UI-29: on the home the name sits left and the
  gear right; on an inner page the round back button comes first, then the title at the page title
  size. A page about
  one thing (a camera) adds the thing's status mark beside its title, and may carry one icon button
  on the right for that thing (a camera's gear, the filter of `Détections`).
- **A settings page also carries `Fermer`** (UI-29): a cross at the far right, drawn as the back
  button, after the page's own icon button. It is the settings' way out, not an action on the page's
  object, and goes through the same questions as leaving them by the back button (UI-15).
- **It never slides with the pages.** When the page changes, only its contents move, vertically: the
  old ones rise out as the new ones come up from below.
- **The alert slot** (UI-30): the bar grows downwards, its height springing to make room for an
  alert and to give it back. Each alert is a line in ink with a quieter second line, and a round
  close button at its end except for Vyzio out of reach; one that closes also leaves by a sideways
  swipe, the same as its close button.
- **The settings apply** (UI-28) is the bar's main action, drawn as one (§ Editing cycle).

### Page transition

Opening a page slides it in from the right, under the bar, while the previous one recedes slightly
and dims; going back is the reverse. Changing tabs or being redirected is not a page change, and
moves no page. Going back stays the bar's back button or the browser's (UI-29): the interface adds
no edge swipe of its own.

### Page header

A page title lives in the top bar, never repeated in the page. A page opens on its content; a lede
appears only to say what the title leaves out (a scope, a timing, a state).

### Status mark

**One mark beside a name** ([SPECS](SPECS.md) UI-31, which says which state takes which mark), `8px`:

| Mark              | Camera         | Capability                                    |
| ----------------- | -------------- | --------------------------------------------- |
| Filled green dot  | Running        | Works                                         |
| Filled grey dot   | Cut, to set up | Any state that is neither working nor failing |
| Hollow coral ring | Offline        | Fails                                         |

The subtitle UI-31 allows sits under the title in ink soft, `15px`. The mark carries its state as its
accessible name.

### Grouped lists

Settings and lists of things read as **grouped lists**: a section label (`13px`, ink soft) above one
surface holding rows split by a line. A row is, in order: an optional round icon, the title with its
mark, an optional subtitle, then what it leads to or the control it holds (a switch, a check). The
chevron says where the row goes: right, to another page; down, a section that opens in place,
turned up while open. A row that adds something (`Ajouter une caméra`, `Ajouter une plage`) is the last row of its
list, neutral, with a `+` icon. No nominal subtitle: a list reads as names.

### Action weight

Two kinds of action, no intermediate style:

- **The main action**: the one green button of a view, full width at the end of a form or under
  what it acts on, `52px` tall (`Ajouter`, `Enregistrer`, `Réactiver`). A view has one at most; a
  second action that matters is neutral.
- **Neutral**: every other action, a pill on the raised colour (`44px` to `48px`) holding a line icon
  that names the action, then its label, or a row of a grouped list. The icon is part of how a neutral
  action is declared, never left out.
- **A toggle** shows a state, not an action: the eye beside a camera's name is an icon button whose
  icon says the state; `Silence` turns amber while it holds. A toggle whose start needs a
  duration opens a sheet (§ Sheets); its end is one tap on the toggle.
- **A destructive action is quiet until confirmed**: a coral-tinted pill with coral ink, last on its
  page, after the `Avancé` fold, alone on its line; solid only on its confirmation's button.
- **Text**: the way out of a sheet or a dialog (`Annuler`), a label with no fill.

Buttons in a row stand `8px` apart and wrap. A footer that settles a dialog aligns its actions to the
end, the confirmation last; on a phone they stack full width, the confirmation on top.

### Tabs

Two or three tabs under a picture or a page head, as pills in one track: the selected one raised, the
others in ink soft. No dot or badge marks something new, on a tab or anywhere else: nothing tracks
what the user has already seen.

The raised pill is one indicator that moves between the tabs. A sideways drag of the content moves
the content and the indicator with the finger, and lands on the tab its momentum projects; a drag
that starts on a control in the content never moves the tabs. Every tab bar shares this behaviour
through its shared component.

### Sheets

A choice that is quick and reversible (a duration, a filter, a clip's actions) opens a **sheet** from
the bottom: a title, one line saying the effect, the options as rows, `Annuler` last. One tap on an
option applies it and closes the sheet; nothing to confirm. A choice along several axes (a filter by
camera, person, type and day) lists each axis as its own group under a quiet heading, its first row
`Toutes`/`Tous` clearing it, the current choice checked. There, a tap checks or unchecks a row, an
axis holding several values at once, or one for the day; the list follows at each tap, so the sheet
stays open and closes with `Fermer` in place of `Annuler`. A chosen day is a date field in its row.

Every sheet rises from the bottom edge and is held by the finger: dragged down, it follows and closes
or comes back as its momentum decides; dragged up, it meets a rubber band. However it closes, it
leaves downwards, without a bounce. One shared component draws every sheet.

### Toasts

A toast rises at the bottom and leaves downwards; raised again while it leaves, it comes back rather
than showing twice. Every toast, one carrying a diagnostic line included, follows a finger dragging
it down and closes when its momentum carries it away: a deliberate gesture closes it like its close
button ([SPECS](SPECS.md) UI-03). Only its top edge takes that drag: a scroll or a selection
starting on its text never closes it. How long it stays is § Errors.

### State pills

Where a word must say a state beside a value (a channel), a pill speaks **one vocabulary
per level**: one set of words, the same for every item of that level, each word one state, never two.
Four tones: `ok`, `warn` (the user has something to do), `danger` (a failure), `neutral` (nothing
wrong, an answer the user gave included). Each feature's words are its use case's. The state of a
camera, a capability, a stream or a protocol is a mark, not a pill (§ Status mark).

### Settings screens

A setting **is declared, it is not drawn**: its nature determines its control and alignment, and
its declaration whether it inherits a value or recommends one ([ADR-15](adr/0015-settings-model-schedules-and-edit-cycle.md); the table from a nature to
its control is the settings renderer's, in code). A page **does not name itself in its content**: its
title is in the bar.

A settings row is always, in this order: **name, help trigger, control, lock or revert arrow**. The
help trigger follows the name's last word. On a phone, the control's nature sets the layout: a
short control (a switch, a number) stands beside the name, on one row of a grouped list, the
number field sized to its value and unit; a long one (a list, a text, a slider) goes under the
name. A value always reads in full ink. A page lists its most common setting first; the rare ones go
to `Avancé`.

**An inherited value reads by a lock beside its field**, never by a subtitle: only a setting with a
real parent value has one (a camera's duration follows the whole installation's); a setting with no
level above, the installation's own included, has none. A **closed lock** in ink soft marks a value
that follows its parent; it is a mark, not a button, named `Valeur de l’ensemble`. An **open lock**
in ink muted marks a value set here; it is the way back, a button named by what it restores
(`Revenir à la valeur de l’ensemble (7 jours)`), and going back is a draft change like any other.

**A value away from its recommendation offers a revert arrow beside its field**, not a lock: a
setting with no parent may declare a recommended value (the installation's durations, the shipped
ones). At its recommendation the field reads plain, with nothing beside it; once it differs, an arrow
in ink soft is a button named by what it restores (`Revenir à la valeur recommandée (7 jours)`), a
draft change like any other. A row carries one or the other, never both: a camera row has the lock
only.

**An option that cannot be chosen yet stays in the list**, greyed and not selectable, with the reason
and the way out on a quieter second line: what is missing, and the screen where it is fixed. The saved
value is the exception: when it can no longer act, it stays choosable, and its consequence line gives
the reason.

**A check, a choice that runs a test, adding or removing are actions**, never draft values
([ADR-15](adr/0015-settings-model-schedules-and-edit-cycle.md)): they act at once and return a result.

### Cards

A thing the user checks or sets, opened from its row (a capability, a protocol) or its page (a
channel), reads as **a card sharing one anatomy**; on a page of its own, the title and its mark sit
in the bar:
**title** with its mark · _state line_ · _settings_ · **actions**.

- **The title** is the plain name of the thing, never a protocol or a technical acronym.
- **The state line** appears only for an exception: it justifies the mark (principle 4) and says what
  to do next, with the diagnostic line when the failure carries one.
- **The settings** are declared rows behind the card's own `Options` fold, closed by default.
- **The actions** close the card in one row, the check first.

**No dead control**: a control is offered only while what it drives works; otherwise one short line
takes its place, naming as a link the page where it is fixed.

### Folds

| Fold                 | Where                                        | Holds                                                                          |
| -------------------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| `Options`            | Inside a card, closed                        | That card's settings                                                           |
| `Avancé`             | Ending the page's settings, closed, in place | Rare settings: a position, not a mode (UI-09); a log of what was sent or asked |
| Help question        | Last on the page, closed                     | Task help (§ Help)                                                             |
| `Détails techniques` | The end of an error or a card, closed        | Figures for support (§ Technical details)                                      |

None stands in for another: no setting in help or technical details, no help in `Avancé`.

**A settings page reads in one order**: its settings, the `Avancé` fold, the removal, then the help
questions. `Avancé` opens where it stands, never one more page except where UI-25 says otherwise:
what it holds that is a thing of its own (a protocol) reads as a card in it. A fold may open on one
quiet line saying what it holds (a lede), never a title.

### Help: three levels, not a manual

How to use a feature lives **in the screen that carries it**
([ADR-17](adr/0017-help-lives-in-the-interface-three-levels.md)), at three depths: what is
**visible** (a label and its cost), a setting's **tooltip**, a **help question** whose text is the
question the reader asks (`Où trouver ces identifiants`, `Une vérification échoue`), never "En savoir
plus". **A tooltip fits in two sentences**. A **cost** never moves down: it stays visible without a
gesture.

**A help question reads as a footnote**, quieter than every setting
(`common/components/help_notes`): a `16px` help icon then the question, both `15px` regular in ink
soft, at least `44px` tall, no surface, no section label, no line between questions, no chevron. Its
answer opens in place under the question's text, `15px` in ink soft. A page's questions sit
**together, last on the page** (§ Folds), never inside a grouped list of real rows. The one
exception is a question that opens by itself because its task is not done yet: it stays under the
section it unblocks.

An **action** says its cost once, before the effect ([SPECS](SPECS.md) UI-16, UI-19): in its
confirmation when it asks one, otherwise in one line above its button. An action that costs nothing
gets no line.

### Technical details: figures for support

A figure the user cannot act on stays in the `Détails techniques` fold
(`common/components/technical_details`). Only the user opens it, and a figure is **never read as a
fault**. It speaks the product's words, never an internal identifier or a technical name
([SPECS](SPECS.md) UI-02). It never holds a setting, an explanation or an error's diagnostic line.

### Where feedback goes

Every piece of feedback has one place, chosen by what caused it, never by the screen it happens on:

| Place                                  | What goes there                                                                                                                                                                                                   | What never does                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Toast**, at the bottom               | The answer to what the user just did: a success, a warning (a camera that did not follow), a failure with its diagnostic line; at most one action, `Réessayer`, when the fix is to do it again                    | A state that outlasts the act; anything the user did not just do |
| **Bar alert** (UI-30)                  | A state that lasts and that no act of the user caused: a camera offline, a camera that did not follow a range or a restart, the disk almost full, Vyzio out of reach, surveillance stopped, a restart that failed | The answer to an act; a state of one page only                   |
| **In place of the content**            | A read that failed, where its data would have been, with `Réessayer` (§ Errors): there is nothing else to show                                                                                                    | A failure under data already shown, which is a toast             |
| **A row's, tile's or card's subtitle** | A state to act on, in one line: `À configurer`, `Coupée jusqu'à 7 h`, `Hors ligne depuis 4 min`; a card's state line also gives the reason of its mark (§ Cards)                                                  | The outcome of an act, an error, a warning                       |

Nothing else: no warning row, no error paragraph in a page. A form's own refusal (a field left
invalid, a password refused) is not feedback from the system: it stays beside its field.

### Errors

An error reads at two levels ([SPECS](SPECS.md) UI-01); where it shows is § Where feedback goes.

- **The sentence** names the effect in the product's words, and what to do when there is something to
  do. It is all the user needs.
- **The diagnostic line** sits under it in a monospace `13px`, ink soft, selectable to be copied. Its
  content comes from the error pipeline ([DASHBOARD-18](rules/dashboard.md)). It never replaces the
  sentence.
- **A toast carrying a diagnostic line or an action stays until dismissed**, long enough to be
  photographed or acted on. Any other toast closes by itself, and the same failure raised twice shows
  once.
- **A read that fails** is never an empty state passing for a real answer.
- **An answer that the thing no longer exists is not a failed read**: it is said as such, with the way
  back, never `Réessayer`.
- **The hub out of reach** is the one error that fills the screen: the product name, a title, the
  sentence, `Réessayer` as the main action and `Détails techniques`, while the app retries on its own
  ([SPECS](SPECS.md) UI-34).

### Empty and loading

- **A list with nothing in it says so in one quiet sentence**, where its items would be, followed by
  the action that fills it when there is one. One shared component draws it. A filter stays offered on
  an empty list only while one is set, to take it back. An unread list is never shown empty.
- **A read in progress shows nothing during a short delay**, so an answer that comes fast never
  flashes. Past it, one shared component shows **skeletons in the shape of the content** it replaces,
  pulsing quietly in the surface colour: rows for a list, picture frames and tiles for the home. Never
  a bare `Chargement…` sentence.

### Full-screen viewing

A picture the user watches and drives is **a screen of its own, with its own route**, never a layer
over a page: the back button returns to the previous page, home when there is nothing to go back to.

- **Upright**, the picture fills the width under the bar, in its own shape, nothing cropped; what acts
  on it sits below, in tabs. A caption or a pill over the picture (`Revenir au direct`) sits on a
  translucent dark plate so it reads over any image.
- **Full screen** (landscape, or the `Plein écran` button), the picture goes edge to edge and the
  controls lie over it, translucent; they fade after a few seconds without a gesture and come back on a
  tap, never while a finger holds one. A line that explains a state never fades. Where each control
  sits is the use case's.
- **The browser's own bars**: in full screen, the screen asks the browser to hide them on a gesture,
  and keeps every control inside the device's safe areas.

### Steering pad

A camera that turns is steered by **one round pad**, never by separate arrow buttons: a circle on
the surface colour with a quiet centre, the four directions as zones of its ring, each at least
`44px` to the touch. The direction held lights up until the finger lifts. Over the picture it is the
same component in its translucent variant, on the glass colour. The saved positions sit apart from
it as named thumbnails, the one at which the camera stands outlined in ink; the empty slots gather
behind a single `Ajouter` tile.

## UX vocabulary

The single home of the interface's shared words. One gesture carries the same word **everywhere**, so
the user learns the interface once.

### Navigation

A label states the **nature** of a screen, viewing or configuring, never its audience
([SPECS](SPECS.md) UI-06).

- Viewing: `Accueil` (the product name in the bar), a camera's view, `Détections`.
- Configuring: `Réglages`, its rubrics in the two sections of UI-36, each section a grouped list.
- Known people are their own rubric, `Personnes`; a camera's `Détection` tab keeps its name.
- Banned as entries: `Expert` (an audience, not a content), `Alertes` for a settings screen, and
  `Historique` (the list of what was seen is `Détections`).
- **A route is English** (`/settings/hardware`, `/settings/schedule`), whatever the French label it
  carries: the address is code, only the displayed words are French (COMMON-01).

### Shared words

- What Vyzio sends to a channel is a **`notification`**, sending it **`notifier`**: never `alerte`,
  `prévenir` or `signaler`. An `alerte` is only what the top bar carries.
- **`Silence`** is the one word for notifications held quiet, by hand or by a range: the cameras keep
  filming and detecting. The spacing between two notifications of the same kind is an
  **`espacement`**, never a silence.
- **`Couper`** is the word of privacy mode, for one camera (`Couper la caméra`) or all
  (`Couper les caméras`); its way back is **`Réactiver`**.
- A time range is a **`plage`**, its rubric **`Planification`**; each type has one name, icon and
  colour, the same in every screen ([SPECS](SPECS.md) SCHED-02): `Caméras coupées` in grey, `Silence`
  in amber.
- A capability is titled by what the camera does, in the product's words: `Flux vidéo`, `Orientation`,
  `Vie privée matérielle`, `Réglages image`. Where a protocol name may appear is UI-02.
- A time reads `22 h`, `7 h 30`, a range `22 h – 7 h`; days `lundi au vendredi`.

### Editing cycle

A setting is saved; surveillance is restarted separately
([ADR-15](adr/0015-settings-model-schedules-and-edit-cycle.md)).

- **`Enregistrer`** is the single verb of validation: it persists, nothing more. A page that edits
  one thing (a range, a camera's name, a channel) saves with its own green `Enregistrer`, its main
  action, at the end of the page. Never `Appliquer` for a save.
- **`Annuler`** is the single verb of abandonment: back to the last saved state.
- The draft is **per page**: leaving a modified page asks for confirmation. A value's **lock**
  (inherited or set here) and its **edit state** (saved or in the draft) read separately.
- **`Appliquer les changements` is the exception**: the restart's trigger, where UI-28 and UI-14 put
  it. It names **the pending
  state**, with the count when it helps (`Appliquer 3 changements`); its question,
  `Redémarrer la surveillance maintenant ?`, names **the act** and states the interruption. A failed
  restart reads as a **breakdown**, persistent, with `Réessayer`.

The underlying rule: **never name the mechanism, always name the effect.** Principle 2 forbids naming
the engine, not saying what is happening.

### Cross-cutting bans

- Never `MQTT`, `broker`, `frigate events`, `sub_label`, `NVR`, nor the name of the detection engine, in
  the nominal journey (product principle 2). The diagnostic line of an error is not the nominal journey.
- Never an opaque state without a readable justification (principle 4).
- Never instructions for use outside the product, nor help that paraphrases the screen (ADR-17).
