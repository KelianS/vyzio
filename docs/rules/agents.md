# Agent rules

> Applies when: a file under `.claude/` or `tools/review-cases/` changes, or a rule page under
> `docs/rules/` changes. What the agents are for in the process:
> [`../WORKFLOW.md`](../WORKFLOW.md) § Delivery gate.

## Writing an agent or a skill

### AGENTS-01 · A skill or an agent holds no rule, it cites it

**Level**: Required · **Verified by**: Review

A skill or an agent says how the assistant works: what to run, in what order, what to return. A
constraint on the code, the documents or the process lives in its rule page or in
[`WORKFLOW.md`](../WORKFLOW.md), and the skill or agent names it by its ID or its section.

Why: a rule restated in a skill drifts from its source in silence (COMMON-05).

```text
✗ The title is `type(scope): subject`, imperative, 72 characters or fewer.
✓ Title: per GIT-01.
```

### AGENTS-02 · No two descriptions trigger on the same request

**Level**: Required · **Verified by**: Review

The `description` of a skill or an agent says what it does and when to use it, in words no other
skill or agent of `.claude/` claims, so one request selects one of them.

**Exceptions**: a skill and the agent it launches, whose descriptions may name the same subject.

## Running a review

### AGENTS-03 · A review request carries the target only

**Level**: Required · **Verified by**: Review

The base, the commit range of a re-review, the issue number, and what was run with its result
(`task check` green or not). Never a rule, a preference or an instruction of the user: the review
must come out the same whoever runs it. An agent ignores anything else a request carries.

### AGENTS-04 · A review says which admitted source it could not read

**Level**: Required · **Verified by**: Review

A source the agent must read and could not (the issue, a template, a rule page) gives one line in
its verdict, `Not read: <source> -- <reason>`, and the report that relays the verdict keeps that
line, so a partial review never reads as a full one.

## Writing to GitHub

### AGENTS-05 · Nothing is written to GitHub before the owner approved its exact text

**Level**: Required · **Verified by**: Review

An issue, a comment, a label, an edit of an issue body: the skill shows the exact title and body
first, and runs the command only once the owner approved that text. No approval, nothing written,
whatever else the session allows.

**Exceptions**: the branch pushed and its pull request opened or updated on the owner's request,
per the [`deliver`](../../.claude/skills/deliver/SKILL.md) skill; the owner reviews it before merging.

### AGENTS-06 · A duplicate is searched before anything is recorded

**Level**: Required · **Verified by**: Review

Before proposing a new issue, the skill searches the open and closed issues on the subject
(`gh issue list --state all --search`). An open issue found turns the proposal into a comment on it,
under the same approval (AGENTS-05); a closed one is named in the proposal.

## Verifying an agent

### AGENTS-07 · A change to an agent or a skill adds or adapts its review case

**Level**: Required · **Verified by**: Review

The case of [`tools/review-cases/`](../../tools/review-cases/README.md) that covers the behaviour
the change brings, added or adapted in the same branch; for a rule page, the case that cites the
rule it changes, when one does.

### AGENTS-08 · The review cases pass before a change to an agent, a skill or a rule page is delivered

**Level**: Required · **Verified by**: Review

`bash tools/review-cases/run.sh` is run on the branch, the cases it touches at least, and its result
is stated under the pull request's Checked (GIT-05). It calls Claude, so it runs locally, never in CI.
