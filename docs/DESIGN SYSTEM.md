# Dashboard Design System

The dashboard's design system: intent, tokens, components, the patterns every screen reuses, the
shared UX vocabulary and the bans. It never describes one feature's behaviour, which is
[SPECS](SPECS.md) or the code and its tests, and never paraphrases the code
([WORKFLOW](WORKFLOW.md) § Writing discipline). The French labels quoted are the product's own copy,
reproduced verbatim.

## Intent

The Vyzio Hub must feel reassuring, readable and domestic, never like an expert NVR tool: a light,
calm interface where the system state shows immediately, recent events read at a glance, primary
actions are explicit, and rare settings sit in depth, out of the everyday path and never naming the
engine underneath (product principle 2).

## Palette

- Surfaces: `--bg-canvas: #f4efe6` the main background, warm rather than clinical;
  `--bg-elevated: #fffaf2` primary surfaces; `--bg-strong: #1f3a33` structural dark panels.
- Ink: `--ink-strong: #18201d` primary text; `--ink-soft: #606d67` secondary text;
  `--line-soft: #d8cfbf` discreet borders.
- Brand: `--brand-moss: #2f6b59` the main product colour; `--brand-sand: #d9b37a` a warm accent.
- Alerts: `--alert-high: #b04c30` a priority event; `--alert-ok: #2d7a52` a healthy state.

These are the light theme values; the dark theme (same roles) lives in `src/index.css`, the single home
of both themes. Usage rules:

- Critical surfaces use `--bg-elevated` to keep a soft contrast.
- `--brand-moss` carries the calls to action and the product indicators.
- `--alert-high` is reserved for important events and attention states.
- Colour never carries a meaning alone: a kind of thing is told apart by its icon and its name, and a
  fill that must be told apart differs by its pattern too.

## Typography

**The scale is Tailwind's, with no root size override** (16px base). Two levels are distinguished by
**three signals at once**, size, weight and colour: one alone does not separate a heading from its
summary.

| Role | Class |
| --- | --- |
| Page title | `font-serif text-3xl` |
| Section or heading title | `font-serif text-2xl` |
| Card title | `font-serif text-lg` |
| Setting label, list entry | `font-medium` (16px) |
| Secondary text, summary, help | `text-sm text-muted-foreground` |

The serif (`--heading`) is reserved for titles; it carries the domestic character of the interface.

## Interface tokens

Radii, two scales never confused (exact values in `src/index.css`, the single home):

| Token | Use |
| --- | --- |
| `--radius`, `--radius-sm/md/lg/xl` | **Clickable** elements (buttons, inputs, small pills), Tailwind's `rounded-*` scale |
| `--radius-inset`, `--radius-card`, `--radius-panel` | **Non-clickable** surfaces (cards, panels, modals) |
| `999px` | The pill, **reserved**: navigation links and status pills |

A soft shadow lifts the elevated surfaces; sections are spaced `24px` to `32px` apart.

**Shape rule: a pill is a state, a rounded rectangle is an action.** A pill means a **non-clickable**
element (a status pill, a badge, a header navigation link); a rounded rectangle (`--radius-sm` /
`--radius`) means a **clickable** one, any action button. That contrast tells a `Connectée` pill from an
`Enregistrer` button at a glance: never give a status pill a raised `box-shadow` or a pronounced border.

## Component foundation

Two tiers, never confused ([ADR-42](adr/0042-interface-component-foundation-shadcn-ui-on-radix-and-tailwind.md)):

- **Primitives**: shadcn/ui code copied into the repository (accessibility, focus, keyboard), modified
  **only** for the theme, never with a business rule inside, outside the project's writing discipline.
- **Vyzio components**, built **on top of** the primitives, carry the product vocabulary (a setting
  field and its provenance, a settings row, a foldable section, the draft bar): the project's code
  discipline applies there.

**The tokens are the source; the Tailwind theme is their realisation.** One styling system, Tailwind
plus tokens: no global class, no literal colour, radius or shadow in a component. The **dark theme is
supported everywhere**: a screen without it is a screen writing a colour by hand. Responsive design
follows the library's scale from the small screen upwards; another breakpoint must be justified.

## Patterns

### Settings screens

A setting **is declared, it is not drawn**: its nature determines its control, alignment, provenance and
undo ([ADR-43](adr/0043-settings-grammar-a-setting-is-declared-not-drawn.md), the home of the control
table). A page **does not name itself**: whatever led there has named it
([ADR-40](adr/0040-information-architecture-viewing-apart-from-configuring-two-level-settings-tree.md)).
`SettingsPage` has no title; `SettingsSection` opens one only in a page covering several subjects, and a
section title repeating the page's means one more page was needed. A section title is in the heading
serif, a setting label in the body weight.

**An option that cannot be chosen yet stays in the list**, greyed and not selectable, with the reason
and the way out on a quieter second line under its label (`text-xs text-muted-foreground`): what is
missing, and the screen where it is fixed. The saved value is the exception: when it can no longer
act, it stays choosable, so the draft can come back to it, and its consequence line gives the reason.

**A check, a choice that runs a test, adding or removing are actions**, never draft values
([ADR-41](adr/0041-settings-edit-cycle-an-explicit-draft-and-saving-means-applying.md)): they act at
once and return a result. Only declared settings follow the page's draft.

### Cards

Things the user checks or sets read as **cards sharing one anatomy**, so a new one takes its place
without a page or a layout of its own: **title** · *state pill* · *state line* · *settings* · **actions**.

- **The title** is the plain name of the thing, never a protocol or a technical acronym.
- **The state line** justifies the pill (principle 4) and says what to do next: when it was last
  verified, or a plain sentence with the way out and, if the failure carries one, the diagnostic line.
- **The settings** are declared rows behind the card's own `Options` fold, closed by default.
- **The actions** close the card in one row, the check first, then what the thing itself allows.

**No dead control**: outside its card, a control is offered only while what it drives works; otherwise
one short line takes its place, naming as a link the page where it is fixed.

### State pills

A pill speaks **one vocabulary per level**: one set of words, the same for every item of that level,
each word one state, never two; a word shared by two levels keeps one meaning in each. Four tones:
`ok`, `warn` (the user has something to do), `danger` (a failure), `neutral` (nothing wrong, an answer
the user gave included). Each feature's words are its SPECS.

### Folds

| Fold | Where | Holds |
| --- | --- | --- |
| `Options` | Inside a card, closed | That card's settings |
| `Avancé` | The end of the page, closed | Rare settings: a position, not a mode (ADR-40) |
| `En savoir plus` panel | Next to what it explains | Task help (§ Help) |
| `Détails techniques` | The end of a card, closed | Figures for support (§ Technical details) |

None stands in for another: no setting in help or technical details, no help in `Avancé`.

### Help: three levels, not a manual

How to use a feature lives **in the screen that carries it**
([ADR-53](adr/0053-user-documentation-lives-in-the-interface-three-levels-of-help.md)), at three depths:
what is **visible** (a label and its cost), a setting's **tooltip**, a section's **`En savoir plus`**
panel. **A tooltip fits in two sentences**: what overflows is about the task, not the field, and goes to
the panel. A **cost** never moves down: it stays visible without a gesture.

An **action** says its cost once, before the effect ([SPECS](SPECS.md) 7.2): in its confirmation when
it asks one, with nothing above the button; otherwise in one line above its button. An action that
costs nothing gets no line.

The panel is `common/components/help_panel`, never a rewritten `<details>`. Its header is the
**question** the reader asks ("Où trouver ces informations ?"), never "En savoir plus"; it opens on its
own only where the task it explains is not yet done.

### Technical details: figures for support

A figure the user cannot act on stays off the card, in the `Détails techniques` fold
(`common/components/technical_details`). Only the user opens it, and a figure is **never read as a
fault**: no line and no warning colour come from it. It speaks the product's words, a thing under the
name the user gave it, never an internal identifier or a technical name ([SPECS](SPECS.md) 1.5). It
never holds a setting, an explanation or an error's diagnostic line.

### Errors

An error reads at two levels ([SPECS](SPECS.md) 1.5).

- **The sentence** names the effect in the product's words, and what to do when there is something to
  do. It is all the user needs.
- **The diagnostic line** sits under it in `font-mono text-xs`, a step quieter (`text-muted-foreground`
  in place, the toast's own foreground at 70 % on the dark toast), selectable to be copied. Its content
  comes from the error pipeline ([`src/dashboard/CLAUDE.md`](../src/dashboard/CLAUDE.md) § Error
  handling). It never replaces the sentence.
- **A toast carrying a diagnostic line stays until dismissed**, long enough to be photographed. Any
  other toast closes by itself, and the same failure raised twice shows once.
- **A read that fails shows where its data would have been**, with `Réessayer`, never an empty or
  welcome state passing for a real answer. Under data already shown, the data stays and the failure
  goes to a toast. It first says what could not be read: a heading when it fills a page nothing else
  names, a plain sentence in a page the shell already names, which never gains a title for it.
- **An answer that the thing no longer exists is not a failed read**: it is said as such, with the way
  back, never `Réessayer`, which cannot succeed.

## UX vocabulary

The single home of the interface's shared words. One gesture carries the same word **everywhere**, so
the user learns the interface once.

### Navigation

A label states the **nature** of a screen, viewing or configuring, never its audience
([ADR-40](adr/0040-information-architecture-viewing-apart-from-configuring-two-level-settings-tree.md)).

- Viewing: `Accueil`, `Direct`, `Historique`.
- Configuring: `Réglages`, then a section (`Caméras`, `Détection`, `Conservation`, `Notifications`,
  `Planification`, `Accès`, `Système`).
- Banned as entries: `Expert` (an audience, not a content), and `Alertes` for a settings screen (it
  promises a list of events, which lives under `Historique`).

### Shared words

- What Vyzio sends to a channel is a **`notification`**, sending it **`notifier`**: never `alerte`,
  `prévenir` or `signaler`. A person is `notifié`, a channel sends `notifications`, a setting says
  `Me notifier`.
- A time range is a **`plage`**, its rubric **`Planification`**; each type has one name, icon and effect
  line, the same in every screen ([SPECS](SPECS.md) 7.3). `Couper` stays the word of privacy mode and
  `Silence` that of the spacing between repeated notifications.
- A capability is titled by what the camera does, in the product's words: `Flux vidéo`, `Orientation`,
  `Coupure matérielle` (as on the privacy screen), `Réglages image`. Where a protocol name may appear
  is SPECS 1.5; help naming protocols or ports sits in `Avancé`, help next to the cards stays plain.

### Editing cycle

A setting is saved; surveillance is restarted separately
([ADR-41](adr/0041-settings-edit-cycle-an-explicit-draft-and-saving-means-applying.md),
[ADR-44](adr/0044-surveillance-restart-an-explicit-user-act-grouped-and-deferred.md)).

- **`Enregistrer`** is the single verb of validation: it persists, nothing more. Never `Appliquer`
  (promises an effect that does not happen) nor `Mettre en service` (hides the interruption).
- **`Annuler`** is the single verb of abandonment: back to the last saved state.
- The draft announces **what has changed**, never an interruption: that belongs to the restart.
- The restart's trigger, `Appliquer les changements`, names **the pending state**, still true when read
  two days later; its question, `Redémarrer la surveillance maintenant ?`, names **the act** and states
  the interruption when deciding. The trigger appears only when something is pending, without naming
  the section. A failed restart reads as a **breakdown**, persistent, with `Réessayer`.

The underlying rule: **never name the mechanism, always name the effect.** Principle 2 forbids naming
the engine, not saying what is happening.

### Cross-cutting bans

- Never `MQTT`, `broker`, `frigate events`, `sub_label`, `NVR`, nor the name of the detection engine, in
  the nominal journey (product principle 2). The diagnostic line of an error is not the nominal journey.
- Never an opaque state without a readable justification (principle 4).
- Never instructions for use outside the product, nor help that paraphrases the screen: navigation, a
  greyed-out button, a missing option already read on screen (ADR-53).
