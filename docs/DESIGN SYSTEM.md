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

**A section title is a title, a setting label is not.** The first is in the heading serif, the second in
the body weight: rendered at the same size in the same face, they give a page where everything sits at
one level and the sections no longer separate anything.

### Help: three levels, not a manual

How to use a feature lives **in the screen that carries it**, never in a document alongside
([ADR-53](adr/0053-user-documentation-lives-in-the-interface-three-levels-of-help.md), the home of the
rule). Three depths: what is **visible** (a setting's label and its cost), a setting's **tooltip**, and
a section's folded **`En savoir plus`** panel.

The boundary between them is checkable: **a tooltip fits in two sentences**. What overflows is talking
about the task rather than the field, and belongs down in the section panel, leaving the one sufficient
sentence in the tooltip. A **cost** never moves down: it stays visible without a gesture.

The panel is the `common/components/HelpPanel` component, never a rewritten `<details>`. Its header
carries the **question** the reader is asking ("Ou trouver ces informations ?") rather than the words
"En savoir plus", which say nothing about what will be found there; it opens on its own only where the
task it explains is not yet done.

An `En savoir plus` panel is not the `Avance` fold, which is an end-of-page position for rare settings
([ADR-40](adr/0040-information-architecture-viewing-apart-from-configuring-two-level-settings-tree.md)):
help opens next to what it explains.

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
- Banned as navigation entries: `Expert` (it names an audience, not a content), and `Alertes` for a
  settings screen, since the word promises a list of events, which the user finds under `Historique`.

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

### Cross-cutting bans

- Never `MQTT`, `broker`, `frigate events`, `sub_label`, `NVR`, nor the name of the detection engine, in
  the nominal journey (product principle 2).
- Never an opaque state without a readable justification (principle 4).
- Never instructions for use outside the product, nor help that paraphrases the screen: navigation, a
  greyed-out button, a missing option already read on screen (ADR-53).
