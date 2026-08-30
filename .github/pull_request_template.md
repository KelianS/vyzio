<!--
Title: type(scope): subject, imperative, lowercase, no final period (<= 72 chars).
Format and vocabulary: docs/WORKFLOW.md section Git. English, like this whole description.
-->

## Why

<!-- What the diff does not show. Not the mechanics: the effect obtained, and for whom. -->

## Scope

Closes #

## Checked

<!-- What was actually run, with its result. An unrun check is not a check. -->

## Definition of done

Tick what the diff actually shows. A line that does not apply is struck through with the reason on
it -- never ticked to keep the list tidy.

- [ ] unit tests added or updated for the behaviour this changes
- [ ] e2e test added or updated for the happy path a user walks through
- [ ] comments follow CLAUDE.md: English, one line, the non-deducible *why*, an ADR reference where
      there is one
- [ ] `docs/` describes the target only -- no history, no "used to be", a rejected option living in
      the 'Options ecartees' of its ADR
- [ ] nothing duplicated: what is new has exactly one home, referenced from anywhere else it comes up
- [ ] no dead code, no unused export, no flag on a path nothing takes any more
- [ ] no implicit dependency on an option that was not retained
