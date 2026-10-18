# Vyzio, context router for the assistant

Vyzio: **privacy-first** home video surveillance, local AI, plug-and-play, French sovereignty.
This file loads in every session. It routes to the right source; every rule has a single home.

## ⛔ Supreme rule: zero duplication

A piece of information has **one home** (COMMON-05). Before writing anything (a doc, a rule, a
principle), check it does not already exist; if it does, point at the source instead of duplicating
it. The only tolerance: a **brief summary that cites its source**, such as the "Product principles"
below, which condense README and SPECS without replacing them.

## Before any significant change

Follow the workflow: **the framing documents are aligned before the code.**
Order, exceptions and governance: [`docs/WORKFLOW.md`](docs/WORKFLOW.md).

## Before opening a pull request

Follow the delivery gate in [`docs/WORKFLOW.md`](docs/WORKFLOW.md) § Git, through the
[`deliver`](.claude/skills/deliver/SKILL.md) skill: `task check`, then the review agents of
[`.claude/agents/`](.claude/agents/). Never merge: that stays with the owner.

## Which file to read for which task

| You are working on… | Source |
| --- | --- |
| A product need, behaviour or journey | [`docs/SPECS.md`](docs/SPECS.md) |
| The rules a change must respect, and how each is verified | [`docs/rules/`](docs/rules/) (routing [`README`](docs/rules/README.md)) |
| The system overview: containers, network flows, data ownership, threats | [`docs/SAD.md`](docs/SAD.md) |
| One precise architectural decision (the *why* of a choice) | [`docs/adr/`](docs/adr/) (index [`README`](docs/adr/README.md)) |
| How a component works in detail (the *how*) | the code and its tests, which name their ADR |
| What a camera model was measured to do | [`docs/hardware/`](docs/hardware/), one dated sheet per model |
| Execution order, slicing, priorities | the [GitHub issues](https://github.com/KelianS/vyzio/issues) (`gh issue list`) |
| Dashboard UI: tokens, components, reusable patterns, shared UI words | [`docs/DESIGN SYSTEM.md`](docs/DESIGN%20SYSTEM.md) |
| How to use a delivered feature | the screen that carries it, in code, [ADR-53](docs/adr/0053-user-documentation-lives-in-the-interface-three-levels-of-help.md) |
| Process, workflow, documentation governance | [`docs/WORKFLOW.md`](docs/WORKFLOW.md) |
| Setup, docker, environment variables, tasks | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Vision, positioning | [`README.md`](README.md) |

The rules load with the folder you edit: [`src/vyzio/CLAUDE.md`](src/vyzio/CLAUDE.md) imports the
backend page, [`src/dashboard/CLAUDE.md`](src/dashboard/CLAUDE.md) the dashboard page,
[`docs/CLAUDE.md`](docs/CLAUDE.md) the documentation page. Code written before a rule does not
follow it yet: never take it as a model.

## Invariants (everywhere, no exception)

- **Privacy first**: never transmit images without explicit consent.
- The common rules and the git rules, which hold everywhere, are imported below.

@docs/rules/common.md

@docs/rules/git.md

## Product principles (they guide every product and UX decision)

Digest, sources: [`README.md`](README.md), [`docs/SPECS.md`](docs/SPECS.md) §1, [`docs/DESIGN SYSTEM.md`](docs/DESIGN%20SYSTEM.md) § Intent.

1. **Non-technical audience**: hide the complexity, zero NVR or home-automation jargon.
2. **Frigate is an implementation detail**: delegate to it everything it covers (do not reinvent the video pipeline), but keep it **invisible and temporary**. The user must never have to know it, see it or name it.
3. **Local-first and resilient**: works offline; the data stays with the user.
4. **Explainability**: no opaque score or state without a readable justification.
5. **Plug and play**: reduce installation and configuration friction as far as it will go.
6. **Unified camera control**: drive every camera directly (PTZ, hardware privacy, settings, Wi-Fi eventually), through a proprietary protocol where needed, to free the user from vendor apps.
7. **Diagnosable errors**: a plain sentence first, then the full technical detail support needs to diagnose from a photo of the screen, never a secret. The one place a technical name may appear ([SPECS](docs/SPECS.md) 1.5).
