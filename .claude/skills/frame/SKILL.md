---
name: frame
description: Frames one issue or a batch of needs-framing issues before any work starts, a milestone included, and puts every open question to the owner in one batch, each with its options and a recommendation. Use when the user asks to frame, settle or prepare issues or a milestone.
argument-hint: "#<n> [#<n>...] | milestone <version>"
---

# frame: one batch of questions, then the framing the owner approved

Where framing sits and what it produces: [`docs/WORKFLOW.md`](../../../docs/WORKFLOW.md) § Mandated
order, § Issues and § Releases. This skill only says how the assistant runs it. It never starts the
implementation: no code, test or configuration edited; framing ends with the documents committed
and the issues updated.

## 1. The batch

The issues named, or those of the milestone: `gh issue list --milestone <version> --label
needs-framing`. Read each one with `gh issue view <n>`.

## 2. The guardians, in parallel

Launch `product-guardian` and `framing-guardian` in one message, each request carrying the target
only (AGENTS-03): the issue numbers of the batch.

## 3. One batch of questions

Every open question of the batch, the guardians' included, duplicates merged, in one message:

```
Framing of #<n>, #<n>: <n> questions
Not read: <guardian> -- <source> -- <reason>     (only a source not read, AGENTS-04)

## <n>. #<issue> -- <the question>
Options:
- A. <option> -- gains <...> -- costs <...>, per source
- B. ...
Recommendation: <option> -- <why, against the sources>
```

A question that only the answer to another one opens is the one exception to a second round.

## 4. Write what the owner approved

From the answers, draft what the mandated order requires: the SPECS, use case or ADR changes, then
each issue's new body and labels, per WORKFLOW § Issues. Show the exact text (AGENTS-05).

Once approved, per DOCS-24:

1. The document changes of each issue are committed as the first commit of that issue's work
   branch, named per WORKFLOW § Git and created from `main` in a worktree of its own, so the
   owner's checkout never moves. A branch that already holds commits is shown to the owner, who
   chooses: rebase it locally onto the framing commit (the owner force-pushes it if it was already
   pushed), or stop there. No pull request is opened from it:
   the documents ship with the code. A stacked docs branch is used only when the owner asks for
   one.
2. Each issue is updated with `gh issue edit <n> --body-file <file>`, and `--remove-label
   needs-framing` once nothing is left to settle.
3. List the branches and commits written, and the issue links.
