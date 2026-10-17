---
name: tech-watch
description: Runs a technology watch on the stack (packages, runtimes, images, actions, the tools behind the rules) and turns the proposals the owner validates into needs-framing issues. Use when the user asks for a tech watch or "veille", whether something should be upgraded or replaced, or what reaches end of support.
argument-hint: "[scope: backend | dashboard | images | ci | <dependency>]"
---

# tech-watch: proposals, then issues the owner validates

Where the watch sits in the process: [`docs/WORKFLOW.md`](../../../docs/WORKFLOW.md) § Technology
watch. This skill only says how the assistant runs it.

## 1. Watch

Launch the `tech-watch` agent. The request carries the scope the user gave (the whole stack
otherwise) and today's date, nothing else: no preference, no expected answer.

## 2. Report

Show the agent's report as it wrote it, proposals sorted by urgency. Add, only if any, one line per
proposal the main agent disputes, with its reason; it removes nothing from the report.

## 3. Record, only what the owner validates

**Nothing is ever recorded without the user's validation**: show the exact title and body of each
issue, and run `gh issue create` only once the user has approved that text, proposal by proposal.
No validation, nothing recorded, whatever else the session allows.

For each approved proposal:

1. Search an open issue on the subject: `gh issue list --search "<subject>"`. Found → show it and ask
   whether to comment it instead; a comment follows the same validation.
2. Otherwise `gh issue create --label needs-framing --label tech-watch` with the approved text. The
   `tech-watch` label missing → create it once with `gh label create tech-watch`, as part of that
   approved recording.
3. List what was created, with the links.

A proposal is never implemented from here: once recorded, it is framed like any `needs-framing`
issue.
