# Dashboard Design System

The interface labels quoted below are the product's own French copy. They are reproduced verbatim
because they are the strings the user reads, not prose to translate.

## Intent

The Vyzio Hub must feel reassuring, readable and domestic, without borrowing the aesthetics of an
expert NVR tool.

The MVP design rests on a light, bright, calm interface with a simple visual hierarchy:

- a system state visible immediately;
- recent events readable at a glance;
- explicit primary actions;
- an advanced route into Frigate, present but secondary.

## MVP palette

- `--bg-canvas: #f4efe6`: the main background, warm rather than clinical.
- `--bg-elevated: #fffaf2`: primary surfaces.
- `--bg-strong: #1f3a33`: structural dark panels.
- `--ink-strong: #18201d`: primary text.
- `--ink-soft: #606d67`: secondary text.
- `--line-soft: #d8cfbf`: discreet borders.
- `--brand-moss: #2f6b59`: the main product colour.
- `--brand-sand: #d9b37a`: a warm accent for emphasis.
- `--alert-high: #b04c30`: a priority event.
- `--alert-ok: #2d7a52`: a healthy state.

These are the light theme values; the dark theme (same roles, its own values) lives in `src/index.css`,
the single home of both themes.

## Usage rules

- Critical surfaces use `--bg-elevated` to keep a soft contrast.
- `--brand-moss` carries the calls to action and the product indicators.
- `--alert-high` is reserved for important events and attention states.
- The advanced Frigate route must stay visible, but never be presented as the main path.

## Typography

**The scale is Tailwind's, with no root size override** (16px base). The original 18px base flattened
the scale: `text-sm` was 14px against a 18px body, too small a gap to separate two levels of
information, which then had to be compensated for in every component.

Two levels are distinguished by **three signals at once**: size, weight and colour. One alone is not
enough, and that is what made a section heading and its summary nearly indistinguishable.

| Role | Class |
| --- | --- |
| Page title | `font-serif text-3xl` |
| Section or heading title | `font-serif text-2xl` |
| Card title (a capability card) | `font-serif text-lg` |
| Setting label, list entry | `font-medium` (16px) |
| Secondary text, summary, help | `text-sm text-muted-foreground` |

The serif (`--heading`) is reserved for titles; it carries the domestic character of the interface.

## Interface tokens

Radii (defined in `src/index.css`, two distinct scales, never confused):

| Token | Use |
| --- | --- |
| `--radius`, `--radius-sm/md/lg/xl` | **Clickable** elements (buttons, inputs, small pills), Tailwind's `rounded-*` scale |
| `--radius-inset`, `--radius-card`, `--radius-panel` | **Non-clickable** surfaces (cards, panels, modals) |
| `999px` | The pill, **reserved**: navigation links and status pills (see the rule below) |

Exact values in `src/index.css`, the single home, not copied here so they cannot drift again.

- Soft shadow: `0 18px 50px rgba(24, 32, 29, 0.08)`
- Section spacing: `24px` to `32px`

### Shape rule: a pill is a state, a rounded rectangle is an action

The radius carries meaning and must never be picked at random:

- **A pill (`999px`)** means a **non-clickable** element: a status pill, a badge, a header navigation link. A pill signals "status or navigation", never "action button".
- **A rounded rectangle** (`--radius-sm` / `--radius`) means a **clickable** element: any action button.

That contrast is what lets the user tell a `Connectee` status pill (a state) from an `Enregistrer` button (an action) at a glance. Never give a status pill a raised `box-shadow` or a pronounced border: it makes it look like a button.

## Component foundation

Two tiers, never confused
([ADR-42](adr/0042-interface-component-foundation-shadcn-ui-on-radix-and-tailwind.md)):

| Tier | What it is | Rule |
| --- | --- | --- |
| **Primitives** | shadcn/ui code copied into the repository (accessibility, focus, keyboard) | Modified **only** for the theme. Never a business rule inside. Not Vyzio code: outside the project's writing discipline. |
| **Vyzio components** | Built **on top of** the primitives, they carry the product vocabulary (a setting field and its provenance, a settings row, a foldable section, the draft bar) | This is where the added value lives, and where the project's code discipline applies. |

Crossing that boundary, lodging a Vyzio rule inside a primitive, reproduces the entanglement this
foundation corrects, and makes every primitive update risky.

**The tokens above are the source; the Tailwind theme is their realisation.** No literal colour, radius
or shadow value is written in a component: it goes through a token. That is what makes a contrast
defect fixable in one place rather than screen by screen.

### Settings screens

A setting **is declared, it is not drawn**: its nature determines its control, its alignment, its
provenance and its undo. The control table and the anatomy of a settings row are fixed by
[ADR-43](adr/0043-settings-grammar-a-setting-is-declared-not-drawn.md), the single
home, not copied here. Drawing a setting by hand is an exception to be justified.

A page **does not name itself**: whatever led there has already named it
([ADR-40](adr/0040-information-architecture-viewing-apart-from-configuring-two-level-settings-tree.md)).
In practice, `SettingsPage` is a surface **without a title**; `SettingsSection` opens a title inside a
page only when that page covers several subjects, and the title then names something other than the
page. A section title that repeats the page title is the sign that one more page was needed.

**An option that cannot be chosen yet stays in the list.** It is greyed and not selectable, with the
reason and the way out on a second, quieter line under its label (`text-xs text-muted-foreground`):
what is missing, and the screen where it is fixed. It is never removed: an option that vanishes
teaches nothing, while a greyed one says that it exists and what it takes. The saved value is the
exception: when it can no longer act, it stays choosable, so the draft can always come back to it,
and the consequence under the control gives its reason in place of an effect it cannot deliver.

**A section title is a title, a setting label is not.** The first is in the heading serif, the second in
the body weight: rendered at the same size in the same face, they give a page where everything sits at
one level and the sections no longer separate anything.

### Capability cards

What Vyzio has checked on a camera ([SPECS](SPECS.md) 2.3) reads as a list of **capability cards**,
one per capability, the video stream first: it is the capability every other one depends on. Every
card follows one anatomy, whatever the capability or its protocol, so a new capability, or a new
setting on one, takes its place without a page or a layout of its own:

**title** · *state pill* · *state line* · *settings* · **actions**

- **The title is the plain name** of what the camera does (§ UX vocabulary, Capabilities), never a
  protocol or a technical acronym.
- **The state pill** says where the capability stands; it is a state, so a pill (§ Shape rule). The
  stream's pill is the camera status itself, the words the camera header shows: one fact, one name.
- **The state line** justifies the pill (principle 4) and says what to do next: when it was last
  verified or last worked, or, when it failed, a plain sentence with the way out, and the diagnostic
  line under it when the failure carries one (§ Errors).
- **The settings** of the capability are declared rows ([ADR-43](adr/0043-settings-grammar-a-setting-is-declared-not-drawn.md)),
  inside its card, behind its `Options` fold, never on the live view.
- **The actions** close the card, in one row: the check (`Verifier`) first, then what the capability
  itself allows (`Activer` / `Desactiver`, `Retirer`, or `Configurer` while it is not set up). A check
  or a configuration runs a real test and returns a result: it is an **action**, never a draft value
  ([ADR-41](adr/0041-settings-edit-cycle-an-explicit-draft-and-saving-means-applying.md)). While the
  stream fails, the other checks are suspended and the page says why ([SPECS](SPECS.md) 2.2). A
  capability whose protocol does not answer says so in its state line, in plain words, with the way
  out (wake the camera, check it is plugged in); one whose protocol refuses the account points at the
  account; any other failure offers the check again or another way to reach it.

The page shows a camera's connection data on its three levels
([ADR-61](adr/0061-camera-connection-data-on-three-levels-access-protocols-capabilities.md)), each
detail once:

- **Identity**: the camera's name, at the top of the page, outside any card.
- **Each capability**: its title, state and check are visible; its **protocol choice and its settings**
  sit behind the card's own `Options` fold, closed by default. The protocol is chosen by its name
  there, and changing it runs its test, so its button says `Configurer`, never `Enregistrer`. The
  choice lists the camera's protocols (the `Avance` boxes) that can carry the capability, answering or
  not: a sleeping camera stays configurable. When none can, a plain sentence points at `Ajouter un
  protocole` in `Avance` instead of an empty list. A capability that already has a card, even a
  failing one, changes its protocol there.
- **`Ajouter une capacite`** closes the list of cards: adding a capability is a capability's action.
  It opens the manual set-up of SPECS 2.3 (the capability, then one of the camera's protocols by
  name, the same list as in `Options`, then an immediate test). When every capability has its card, the place says so and points at the cards'
  `Options`.
- **The page's `Avance` fold**: the camera's access (address, account), then one box per protocol the
  camera speaks, with its state pill (`Repond`, `Refuse l'acces` when the account or the device number
  is turned down, `Ne repond pas`, `Pas encore verifie`), its port, its optional
  `Compte specifique` and its own `Verifier`, then `Retirer`; then `Ajouter un protocole` (a protocol
  the camera does not have yet, its port, the usual one when left empty, an optional
  `Compte specifique`, checked at once). A protocol check goes through no capability, so it is never
  suspended by a failing stream. The specific account says it is only presented to the camera, on the
  local network. `Retirer` is refused, with the plain reason next to it, while a capability goes
  through the protocol or while its box has unsaved edits.
- **The stream's way out** names both places: the address and account in `Avance`, the protocol and
  path in the stream card's `Options`.

Addresses, ports, paths and accounts are declared settings and follow the page's draft; a check, a
protocol choice, adding a capability or a protocol and removing a protocol are actions.

### Help: three levels, not a manual

How to use a feature lives **in the screen that carries it**, never in a document alongside
([ADR-53](adr/0053-user-documentation-lives-in-the-interface-three-levels-of-help.md), the home of the
rule). Three depths: what is **visible** (a setting's label and its cost), a setting's **tooltip**, and
a section's folded **`En savoir plus`** panel.

The boundary between them is checkable: **a tooltip fits in two sentences**. What overflows is talking
about the task rather than the field, and belongs down in the section panel, leaving the one sufficient
sentence in the tooltip. A **cost** never moves down: it stays visible without a gesture.

For an **action**, the cost is said once, before the effect ([SPECS](SPECS.md) 7.2). When the action
asks for a confirmation, the confirmation says it: it opens on the gesture that triggers the action, so
it takes no gesture of its own, and nothing above the button repeats it. An action without a
confirmation says its cost in one line above its button. An action that costs nothing gets no line at
all: its title and its button are enough.

The panel is the `common/components/help_panel` component, never a rewritten `<details>`. Its header
carries the **question** the reader is asking ("Ou trouver ces informations ?") rather than the words
"En savoir plus", which say nothing about what will be found there; it opens on its own only where the
task it explains is not yet done.

An `En savoir plus` panel is not the `Avance` fold, which is an end-of-page position for rare settings
([ADR-40](adr/0040-information-architecture-viewing-apart-from-configuring-two-level-settings-tree.md)):
help opens next to what it explains.

### Technical details: figures for support

On a viewing screen, a figure the user cannot act on (a frame rate, the detection hardware) is not
shown on the card: it sits in a **`Details techniques`** fold at the end of the card it belongs to,
closed by default. The fold is the `common/components/technical_details` component, never a rewritten
`<details>`. It follows three boundaries:

- **A fault is never only a figure**: when a watched camera no longer keeps up, the fold opens on its
  own and a plain sentence first names the camera and what to check (principle 4). It never closes by
  itself. A paused camera sends nothing on purpose: that is not a fault.
- **It speaks the product's words**: a camera shows under the name the user gave it, never an internal
  identifier; one Vyzio no longer knows reads `Camera retiree ou renommee`. It is not a place for
  technical names ([SPECS](SPECS.md) 1.5).
- **It is neither `Avance` nor help nor an error's detail**: it holds no setting (those go to the
  `Avance` fold), no explanation (the `En savoir plus` panel), and never the diagnostic line of an
  error, which stays visible under its sentence (§ Errors).

### Style and theme

`App.css` (global CSS with hand-named classes) no longer exists: one styling system only, Tailwind plus
tokens ([ADR-42](adr/0042-interface-component-foundation-shadcn-ui-on-radix-and-tailwind.md)). No global
class, no literal colour or radius in a component, always a token.

The **dark theme is supported everywhere**. Since every colour used is a token carrying both its values,
a screen without a dark version is a screen writing a colour by hand.

Responsive design follows the library's scale, applied from the small screen upwards. A breakpoint
outside that scale is an exception to be justified.

## UX vocabulary

The single home of the interface's words. One gesture carries the same word **everywhere**; that is what
lets the user learn the interface once.

### Navigation

A label states the **nature** of a screen, viewing or configuring, never the audience it targets
([ADR-40](adr/0040-information-architecture-viewing-apart-from-configuring-two-level-settings-tree.md)).

- Viewing: `Accueil`, `Direct`, `Historique`.
- Configuring: `Reglages`, then a section (`Cameras`, `Detection`, `Conservation`, `Notifications`, `Systeme`).
- The end-of-page fold is called `Avance`. It is not a mode to switch on: it is a position.
- The in-card fold of figures for support is called `Details techniques` (§ Technical details).
- Banned as navigation entries: `Expert` (it names an audience, not a content), and `Alertes` for a
  settings screen, since the word promises a list of events, which the user finds under `Historique`.

### Notifications

What Vyzio sends to a channel is a **`notification`**, and sending it is **`notifier`**, the words of the
`Notifications` section that configures it. One notion, one word: `alerte`, `prevenir` and `signaler`
are not used for it. A person is `notifie`; a channel sends `notifications`; a setting says
`Me notifier`.

### Capabilities

A capability card is titled by what the camera does, in the words the rest of the product already
uses for it: `Flux video` (the stream), `Orientation` (the motorised head), `Coupure materielle`
(the hardware privacy cut, as on the privacy screen), `Reglages image`. A protocol name (`RTSP`,
`ONVIF`, `DVRIP`...) reads the same wherever it appears, the box title, every choice list and every
sentence; a choice adds only `(par défaut)` to the default protocol of a capability. It appears only where a protocol is chosen or reached, the page's `Avance` fold,
each card's `Options` fold and the form that adds a capability, and in the diagnostic line of an error ([SPECS](SPECS.md) 1.5). Help that
names protocols or ports sits in the `Avance` fold; the help next to the cards stays in plain words.

### Editing cycle

A setting is saved; surveillance is restarted separately
([ADR-41](adr/0041-settings-edit-cycle-an-explicit-draft-and-saving-means-applying.md),
[ADR-44](adr/0044-surveillance-restart-an-explicit-user-act-grouped-and-deferred.md)).

- **`Enregistrer`** is the single verb of validation. It persists, and nothing more: surveillance is not
  touched. Never call it `Appliquer` or `Mettre en service`; the first promises an effect that does not
  happen, the second hides the interruption behind a generic service term.
- **`Annuler`** is the single verb of abandonment; it returns the page to its last saved state.
- The draft announces **what has changed**. It no longer announces an interruption: that belongs to the
  restart.

| Where | Text |
| --- | --- |
| Trigger | `Appliquer les changements` |
| Question | `Redemarrer la surveillance maintenant ?` |
| Body | `Des reglages enregistres ne sont pas encore appliques. La surveillance s'interrompt quelques secondes.` |
| In progress | `Redemarrage…` |
| Failure | `Redemarrage echoue`, persistent, with `Reessayer` |

The trigger names **the pending state**, the question names **the act**. This is not a stylistic nuance:
the trigger outlives the session in which the setting was saved, and gets read two days later without
anything having restarted in between. `Redemarrer` would announce an act already done there;
`Appliquer les changements` says what stays true until it is clicked. The interruption itself is never
kept quiet: it is stated at the moment of deciding.

The trigger **appears only when there is something to pick up again**: its presence is the message, its
absence positive information. The pending section is not named, because a category from our own tree
teaches nothing to someone who has just set a value.

The underlying rule, valid beyond this case: **never name the mechanism, always name the effect.**
Product principle 2 forbids saying the name of the engine, not saying what is happening.

- A failed restart is stated in terms of **breakdown**, not of a remaining step.

### Errors

An error reads at two levels ([SPECS](SPECS.md) 1.5).

- **The sentence** names the effect in the product's words, and what to do when there is something to
  do. It is all the user needs.
- **The diagnostic line** sits under it in `font-mono text-xs`, a step quieter than the sentence
  (`text-muted-foreground` in place, the toast's own foreground at 70 % on the dark toast), and
  selectable so it can be copied. What it holds is built by the error pipeline
  ([`src/dashboard/CLAUDE.md`](../src/dashboard/CLAUDE.md) § Error handling). It never replaces the
  sentence.
- **A toast carrying a diagnostic line stays until it is dismissed**, long enough to be read and
  photographed. Any other toast closes by itself, and the same failure raised twice shows once.
- **A read that fails shows where its data would have been**, with `Réessayer`, never an empty or
  welcome state that passes for a real answer. When it fails under data already shown, the data stays
  and the failure goes to a toast.
- **A failed read first says what could not be read**, before the error's own sentence: a heading when
  the failure fills a page nothing else names, a plain sentence inside a page the shell already names,
  which never gains a title for it (§ Settings screens).
- **An answer that the thing no longer exists is not a failed read**: it is said as such, heading or
  sentence by the same measure, with the way back, never `Réessayer`, which cannot succeed.

### Cross-cutting bans

- Never `MQTT`, `broker`, `frigate events`, `sub_label`, `NVR`, nor the name of the detection engine, in
  the nominal journey (product principle 2). The diagnostic line of an error is not the nominal journey.
- Never an opaque state without a readable justification (principle 4).
- Never instructions for use outside the product, nor help that paraphrases the screen: navigation, a
  greyed-out button, a missing option already read on screen (ADR-53).
