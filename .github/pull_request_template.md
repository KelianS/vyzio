<!--
Title: type(scope): subject, imperative, lowercase, no final period (<= 72 chars).
Format and vocabulary: docs/rules/git.md. English, like this whole description. Keep it short.
-->

## Why

<!-- One sentence: the problem this solves, and for whom. Never the mechanics. -->

Closes #

## Changes

<!-- The major changes only, one short line each. Upgrading needs an action from whoever hosts Vyzio (environment variable, compose file, port, data reset)? One last line: "Breaking: <what to do>". -->

-

## Screenshots

<!-- Any change to what the interface shows: before and after (GIT-07). Otherwise strike the heading through with the reason. -->

## Definition of done

<!-- Tick what the diff shows; strike a line that does not apply, with its reason. -->

- [ ] `task check` green, review gate passed on the last commit (GIT-08)
- [ ] a test that fails without the change (COMMON-15)
- [ ] e2e for the journey a user walks through (DASHBOARD-30)
- [ ] comments: one line, the non-deducible *why* (COMMON-02, COMMON-03)
- [ ] `docs/` describes the target only (DOCS-06, DOCS-08)
- [ ] nothing duplicated, nothing unreached (COMMON-05, COMMON-08)
- [ ] no implicit dependency on an option that was not retained
