---
name: tech-watch
description: Runs a technology watch on the stack (packages, runtimes, images, actions, the tools behind the rules) and turns the proposals the owner validates into needs-framing issues. Use when the user asks for a tech watch or "veille", whether something should be upgraded or replaced, or what reaches end of support.
argument-hint: "[scope: backend | dashboard | images | ci | <dependency>]"
---

# tech-watch: proposals, then issues the owner validates

Where the watch sits in the process: [`docs/WORKFLOW.md`](../../../docs/WORKFLOW.md) § Technology
watch. This skill only says how the assistant runs it.

## 1. Watch

Launch the `tech-watch` agent. The request carries its target only (AGENTS-03): the scope the user
gave (the whole stack otherwise) and today's date.

## 2. Report

Show the agent's report as it wrote it, proposals sorted by urgency. Add, only if any, one line per
proposal the main agent disputes, with its reason; it removes nothing from the report.

## 3. Record, only what the owner validates

Recording follows AGENTS-05 and AGENTS-06, proposal by proposal:

1. Search: `gh issue list --state all --search "<subject>"`.
2. Show the exact text: a comment on the open issue found, otherwise the draft issue.
3. Once approved, `gh issue comment`, or `gh issue create --label needs-framing --label tech-watch`.
   The `tech-watch` label missing → create it once with `gh label create tech-watch`.
4. List what was created or commented, with the links.

A proposal is never implemented from here: once recorded, it is framed like any `needs-framing`
issue.
