# Vyzio, context router for the assistant

Vyzio: **privacy-first** home video surveillance, local AI, plug-and-play, French sovereignty.
This file loads in every session. It routes to the right source; every rule has a single home.

## ⛔ Supreme rule: zero duplication

A piece of information has **one home**: the file that is its source. Everywhere else it is
**referenced**, never copied. Before writing anything (a doc, a rule, a principle), check it does not
already exist; if it does, point at the source instead of duplicating it.

The only tolerance: a **brief summary that cites its source**, such as the "Product principles" below,
which condense README and SPECS without replacing them.

## Before any significant change

Follow the workflow: **the framing documents are aligned before the code.**
Order, exceptions and governance: [`docs/WORKFLOW.md`](docs/WORKFLOW.md).

## Which file to read for which task

| You are working on… | Source |
| --- | --- |
| A product need, behaviour or journey | [`docs/SPECS.md`](docs/SPECS.md) |
| Overall architecture, boundaries, cross-cutting choices | [`docs/SAD.md`](docs/SAD.md) |
| One precise architectural decision (the *why* of a choice) | [`docs/adr/`](docs/adr/) (index [`README`](docs/adr/README.md)) |
| How a component works in detail (the *how*) | [`docs/design/`](docs/design/) (catalogue [`README`](docs/design/README.md)) |
| Execution order, slicing, priorities | the [GitHub issues](https://github.com/KelianS/vyzio/issues) (`gh issue list`) |
| Dashboard UI: buttons, status pills, modals, tokens | [`docs/DESIGN SYSTEM.md`](docs/DESIGN%20SYSTEM.md) |
| How to use a delivered feature | the screen that carries it, in code, [ADR-53](docs/adr/0053-user-documentation-lives-in-the-interface-three-levels-of-help.md) |
| Process, workflow, documentation governance | [`docs/WORKFLOW.md`](docs/WORKFLOW.md) |
| Setup, docker, environment variables, tasks | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Vision, positioning | [`README.md`](README.md) |

The **backend** rules ([`src/vyzio/CLAUDE.md`](src/vyzio/CLAUDE.md)) and the **frontend** rules
([`src/dashboard/CLAUDE.md`](src/dashboard/CLAUDE.md)) load automatically as soon as you edit a file
in those folders.

## Invariants (everywhere, no exception)

- **Privacy first**: never transmit images without explicit consent.
- Everything in this repository is written in **English**, code and prose alike. The two exceptions
  are `docs/SPECS.md` and `docs/BUSINESS_PLAN.md`, which frame the business for a French market.
  Rule and current state: [`docs/WORKFLOW.md`](docs/WORKFLOW.md) § Language.
- **Commits and PRs** (title and description): English, Conventional Commits format. Rule and
  template in [`docs/WORKFLOW.md`](docs/WORKFLOW.md) § Git.
- **Code comment**: English, one line, never a paragraph. The *why* that cannot be deduced, with an
  ADR reference where useful (`(ADR-44)`), never the story of the decision, which ages in silence and
  duplicates the ADR (supreme rule above). If the explanation does not fit on one line, it belongs in
  an ADR or a TAD; point at it rather than copying it.
- **Test name**: `{Method}_Should{DoSomething}_When{ConditionIsTrue}`, PascalCase, in xUnit as in
  Vitest. The name carries the subject, the expected effect and the condition, so a CI failure reads
  without opening the test body. Tests written before this rule do not follow it yet: do not take them
  as a model.

## Product principles (they guide every product and UX decision)

Digest, sources: [`README.md`](README.md), [`docs/SPECS.md`](docs/SPECS.md) §1, [`docs/DESIGN SYSTEM.md`](docs/DESIGN%20SYSTEM.md) § Intent.

1. **Non-technical audience**: hide the complexity, zero NVR or home-automation jargon.
2. **Frigate is an implementation detail**: delegate to it everything it covers (do not reinvent the video pipeline), but keep it **invisible and temporary**. The user must never have to know it, see it or name it.
3. **Local-first and resilient**: works offline; the data stays with the user.
4. **Explainability**: no opaque score or state without a readable justification.
5. **Plug and play**: reduce installation and configuration friction as far as it will go.
6. **Unified camera control**: drive every camera directly (PTZ, hardware privacy, settings, Wi-Fi eventually), through a proprietary protocol where needed, to free the user from vendor apps.
