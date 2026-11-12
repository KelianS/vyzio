# ADR template and writing guide

An ADR records **one structural decision**: the choice, why it was made, and what it costs. It is
the *why*; the SAD gives the overview, the code and its tests carry the *how*
([`../WORKFLOW.md`](../WORKFLOW.md) § Document architecture). The rules that hold an ADR to its
nature are DOCS-07, DOCS-08, DOCS-11, DOCS-12 and DOCS-21 to DOCS-23 of
[`../rules/docs.md`](../rules/docs.md); this guide cites them, it does not restate them.

## When to write one

Only when the decision meets the bar of DOCS-07 (and DOCS-02 for a decision taken in code).

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

> Status: Accepted

## Context

<The forces at play: the need it answers (cite the SPECS or use case ID), the constraints, the
facts measured (cite the hardware sheet). No solution yet.>

## Decision

<The choice, in the present tense, at the level of structure: what owns what, which flow, which
contract, which dependency. No value the code holds, no screen.>

## Consequences

- <What becomes easier, what becomes harder, what it costs to reverse.>

## Options rejected

- **<Option>**: <what it was, and why it lost>.
```
