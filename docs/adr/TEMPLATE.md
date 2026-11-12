# ADR template and writing guide

An ADR records **one structural decision**: the choice, why it was made, and what it costs. It is
the *why*; the SAD gives the overview, the code and its tests carry the *how*
([`../WORKFLOW.md`](../WORKFLOW.md) § Document architecture). The rules that hold an ADR to its
nature are DOCS-07, DOCS-08, DOCS-11, DOCS-12 and DOCS-21 to DOCS-23, DOCS-25 of
[`../rules/docs.md`](../rules/docs.md); this guide cites them, it does not restate them.

## When to write one

An ADR documents a structural choice, one that meets the bar of DOCS-07; an obvious choice, or one
easy to reverse and below that bar, does not deserve one. Its ADR comes in the same branch as the
code (DOCS-02).

An ADR in this folder is in force: it carries no status, and the pull request that merges it is
its validation.

## What an ADR holds, and what goes elsewhere

An ADR holds the forces that made the choice, the choice in the present tense, what it costs, and
the options it rejected. Everything else has its home:

| Never in an ADR | Its home | Rule |
| --- | --- | --- |
| A state, a wording, a screen, the order of a journey | a SPECS rule or a use case under [`../uc/`](../uc/) | DOCS-07, DOCS-19 |
| What a camera model was measured to do | its sheet under [`../hardware/`](../hardware/) | DOCS-07, DOCS-14 |
| How a component works, a value, a route, a schema | the code and its tests | DOCS-07, DOCS-11 |
| The road travelled, what was tried before | the "Options rejected" section only, or Git | DOCS-08 |
| Another ADR's decision | its number, at most a few words on what it settles | DOCS-12 |

## Changing a decision

- **The same decision moves**: the ADR is rewritten to its new target, the option it leaves goes
  under its "Options rejected" (DOCS-21).
- **The decision is replaced or merged into another**: the old file is deleted, its citations
  repointed (DOCS-22), and the numbering closed up (DOCS-23).
- **A new subject**: a new ADR, numbered next (DOCS-23).

## Citing one

By its number, `ADR-04`: a link to its file in a document, a one-line comment in code
(COMMON-02, COMMON-03). Never by a section or a letter of its decision, which moves when the ADR is
rewritten.

## Template

```markdown
# ADR-<NN>: <the target, stated as the decision taken>

## Context

<What situation forced a decision? The need it answers (cite the SPECS or use case ID), the
constraints, the facts measured (cite the hardware sheet). No solution yet.>

## Decision

<What was decided, in one direct sentence.>

- <Only if needed: the structural detail, what owns what, which flow, which contract, which
  dependency. No value the code holds, no screen.>

## Consequences

- ✅ <What it gains.>
- ⚠️ <What it costs, or a risk it accepts.>

## Options rejected

| Option | Why rejected |
| --- | --- |
| <Option> | <Why it lost> |
```
