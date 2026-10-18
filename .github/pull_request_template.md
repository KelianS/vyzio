<!--
Title: type(scope): subject, imperative, lowercase, no final period (<= 72 chars).
Format and vocabulary: docs/rules/git.md. English, like this whole description.
-->

## Why

<!-- What the diff does not show. Not the mechanics: the effect obtained, and for whom. -->

## Scope

Closes #

## Checked

<!-- What was actually run, with its result. An unrun check is not a check. -->

## Screenshots

<!-- Any change to what the interface shows: before and after (GIT-07). Otherwise strike the heading through with the reason. -->

## Definition of done

Tick what the diff actually shows. A line that does not apply is struck through with the reason on
it -- never ticked to keep the list tidy.

- [ ] a test that fails without the change, for the behaviour it changes (COMMON-15)
- [ ] e2e test added or updated for the journey a user walks through (DASHBOARD-30)
- [ ] comments: one line, the non-deducible *why*, no story (COMMON-02, COMMON-03)
- [ ] `docs/` describes the target only, a rejected option living under the 'Options rejected' of
      its ADR (DOCS-06, DOCS-08)
- [ ] nothing duplicated: what is new has exactly one home (COMMON-05)
- [ ] nothing left that nothing reaches (COMMON-08)
- [ ] no implicit dependency on an option that was not retained
