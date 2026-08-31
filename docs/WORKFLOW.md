# Workflow and documentation governance

The source of truth for how work happens in this repository. Every significant change follows this
order; starting the implementation before the upstream documents are aligned is forbidden.

## Mandated order

1. **SPECS** ([`SPECS.md`](SPECS.md)) if the product need changes: user stories, journeys, MVP scope.
2. **SAD** ([`SAD.md`](SAD.md)) if the technical solution or the boundaries change: components,
   responsibilities, ADRs.
3. **Issues** ([GitHub](https://github.com/KelianS/vyzio/issues)) for execution order, slicing,
   dependencies, definition of done. An issue leans on the documents above, it does not re-decide them.
4. **Implementation**, minimal code, consistent with the validated documents.
5. **Tests**, targeted validation of the modified slice, mandatory.
6. **Help inside the interface**: every deliverable feature is documented **in the screen that carries
   it**, across the three levels of
   [ADR-53](adr/0053-user-documentation-lives-in-the-interface-three-levels-of-help.md).
   No instructions for use outside the product.

## Practical rules

- A feature that changes neither the need, nor the architecture, nor the plan goes straight to
  implementation, then tests.
- A feature that contradicts an existing document means updating the document **before** writing code.
- The backlog is never where the strategy is discovered after the fact; it expresses a strategy already
  decided in the SPECS and the SAD.
- No pull request is clean when the code is up to date and the framing documentation lags behind.

## Document architecture (types of document)

| Type | Role | Home | Stability |
|---|---|---|---|
| **SPECS** | Need, journeys, product scope | [`SPECS.md`](SPECS.md) | medium |
| **SAD** | Boundaries, major choices, the overall picture; **references** the code, never paraphrases it | [`SAD.md`](SAD.md) | high |
| **ADR** | One architectural decision per file (Context, Options, Decision, Consequences) | [`adr/`](adr/), one `NNNN-slug.md` per decision, index [`adr/README.md`](adr/README.md) | frozen once `accepted` |
| **TAD** | *How* a subsystem works (detail too specific for the SAD) | [`design/`](design/), one `.md` per component, catalogue [`design/README.md`](design/README.md) | medium |
| **Investigation** | Exploration, trials, reverse engineering, captures | [`investigations/`](investigations/) | disposable |
| **User help** | How to use a delivered feature | the screen that carries it, in code (ADR-53) | follows the feature |

The chain: the SAD sets the **boundaries**, an ADR **settles** a decision (and states the options it
rejected), a TAD documents the **how** of a component, and the code **does**. Each has its own home,
nothing is copied.

**Scaling rules:**
- The body of the SAD does not move when a decision is added: a new ADR is a file in `adr/` plus one
  index line. SAD §5 **points at** the index, it does not copy it.
- A superseded ADR is never deleted: its status becomes `superseded by ADR-NNNN`, and the decision
  that replaces it summarises the abandoned option under its own "Options rejected" heading.
- Low-level detail (byte frames, port catalogues, the SQL schema, payloads, route lists) lives in a
  **TAD** or in the **code**, never duplicated into an ADR or the SAD, which reference it.

## Writing discipline (the nature of each document)

Each document has a **nature**; respecting it is what stops it from swelling and going stale.

- **A SAD is the target, not the history.** The SAD describes the **intended** architecture, in the
  present tense, never what was done before nor the road travelled. The one place where "what was done
  before" may appear is the **"Options rejected"** heading of an ADR, whose value is explaining *why
  not*. Forbidden: stacking chronological "Correction (a)(b)(c)..." entries in an ADR; merge them into
  the target decision. An ADR title states the target ("X rejected, Y chosen"), not the history ("X
  attempted then abandoned").
- **Do not paraphrase the code.** The SQL schema, signatures, byte frames and route lists have their
  home in the code (EF entities, endpoints, catalogues). Documents **reference** them, they do not copy
  them. This is the supreme zero-duplication rule applied to the doc/code pair.
- **Exploration history** (trials, network captures, reverse engineering) goes to
  [`investigations/`](investigations/), never into the SAD.

## Precedence (one piece of information, one home)

Vision goes to [`../README.md`](../README.md) · the need to `SPECS.md` · the technical solution to
`SAD.md` · the execution plan to **the issues** · how to use a feature to **the screen itself**
(ADR-53).

Every document states its own role in its header. When in doubt, climb to the right level: vision,
need, architecture, execution, use. Never copy information from one document into another, see the
supreme zero-duplication rule in [`../CLAUDE.md`](../CLAUDE.md).

## Language

**The repository is written in English**, code and prose alike: comments, commits, pull requests,
issues, templates, labels, and every framing document. One file is the exception and stays in French,
[`SPECS.md`](SPECS.md), because it frames the product for a French market and is read as much by
non-engineers as by contributors.

One gap remains, and it is deliberate. The **bodies of the ADRs are still in French**, while their
filenames are already English. Renaming is the operation that breaks links, so it was done once, on its
own, ahead of any translation of the content. Until that translation lands, an existing ADR is read in
French. **A new ADR is written in English**, like everything else.

## Git

- Branches: `main` (stable), `dev` (integration), `feature/*` (work in progress).
- Pull requests: review and green tests are mandatory.

### Commits and pull requests, English and conventional

A commit and a pull request address the tooling and third parties rather than the framing documents, so
they follow the language of the code, **English**, and the [Conventional
Commits](https://www.conventionalcommits.org/en/v1.0.0/) format: subject, body, pull request title and
description alike.

```
type(scope): imperative subject, lowercase, no trailing period (72 characters or fewer)

The body says the *why*: what the diff does not show. A blank line separates
it from the subject. ASCII only.

Co-Authored-By: ...
```

- **type**: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `chore`. A breaking change is
  written `type(scope)!: ...`.
- **scope**: the subject touched, optional but preferred: `api`, `dashboard`, `access`, `onboarding`,
  `recording`. Exactly one, the one that carries the change. **The scope carries the theme**: there is
  no theme label, the grouping reads from the title and is searched through it.
- **subject**: the effect obtained, not the mechanism used. What it changes for whoever reads it, never
  "adds an X method".
- **pull request**: title in the same format as a commit subject, description in English, saying the
  *why*, the scope, and what was verified. Template:
  [`pull_request_template.md`](../.github/pull_request_template.md), which also carries the
  **definition of done**, whose home is there, where it gets ticked.

### Issues, two templates and one state

The **title** is always English and conventional: it becomes the pull request title as it stands, then
the commit subject, written once and reused.

Two templates in [`.github/ISSUE_TEMPLATE/`](../.github/ISSUE_TEMPLATE/): **Feature** and **Bug**.

There is **no "idea" template**: an idea is a feature whose direction has not been settled yet, which
makes it a **state**, not a category. The issue is opened with the objective alone and the
`needs-framing` label; the SPECS or an ADR settle it; the rest is filled in and the label removed.
Nothing gets built while it is up, which is the mandated order above, made visible.

A template **reminds, it does not enforce**: GitHub imposes it neither on the web nor through
`gh issue create`. What would truly enforce the format is an integration check, and there is none.
