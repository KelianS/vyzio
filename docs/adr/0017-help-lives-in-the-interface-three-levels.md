# ADR-17: Help lives in the interface, at three levels

## Context

The user needs help at the moment of hesitation, in front of the setting that causes it, not in a
manual somewhere else. User guides kept beside the product were opened by nobody, paraphrased the
interface (navigation, greyed buttons, options a given user never sees) and duplicated what the
screens already showed, so they diverged, against the single home of an information (COMMON-05).

The product is local-first: its help must open offline and match the installation in front of the
user (principle 3). A tooltip cannot carry a multi-step task, a list of conditions or a link.

## Decision

How to use a feature lives in the screen that carries it, at three depths, each opened only when the
one before was not enough.

- **Level 1, visible without a gesture**: the setting's label and its consequence. It answers "what
  do I decide here, and what does it cost?". A cost always stays at this level.
- **Level 2, a tooltip behind an explicit trigger** on the setting's name, reachable by finger as by
  mouse. It speaks about the field.
- **Level 3, a folded help panel** attached to a section or a screen. It speaks about the task: how
  to do it, what a step needs. It is the only place for what used to be a user guide.
- **The tooltip has a verifiable budget**: what overflows it is about the task, and goes down to the
  panel, leaving the tooltip the sentence that suffices.
- **Diagnosis is not a chapter.** An error carries its remedy and a state reads where it happens
  (UI-01); the panel only holds what no state can show.
- **A screen that cannot be passed keeps its help in place.** First start, sign-in and an
  installation failure have no screen behind which to fold help: it lives in the state they show.
- **Only two things stay outside the product**: what one reads before having it (the README) and the
  installation of the product itself (the contributing guide), since an interface that has not
  started cannot document its own start.

## Consequences

- ✅ Help is where the question arises, offline, and matches the installation on screen.
- ✅ A panel attached to a section has room only for what the screen does not already show, so
  paraphrase has nowhere to go.
- ✅ The help levels are parts of the declared setting (ADR-15): a new setting gets its label,
  consequence and tooltip slots without design work.
- ⚠️ Linear reading and full-text search of a manual are lost; a non-technical user goes back to the
  screen where they saw something, not to a keyword.
- ⚠️ Every delivered feature documents itself in its own screen, in the same change.

## Options rejected

| Option | Why rejected |
| --- | --- |
| Separate user guides kept up to date by discipline | Nobody opened them, they paraphrased the screens, and the duplication appeared in the very change that forbade it. |
| Everything in the setting tooltips | A popover holds no multi-step task, no list of conditions, no link; the content would be both drowned and unreadable. |
| An online documentation site | Help depending on a connection and a host contradicts local-first, and nothing ties the online version to the installation in front of the user. |
