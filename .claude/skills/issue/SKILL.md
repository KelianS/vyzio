---
name: issue
description: Turns a bug, a need, an idea or a camera report the user describes into one new GitHub issue, from a duplicate search to the text the owner approves. Use when the user asks to record, open, file or log an issue or a bug. Not for the reviewers' feedback on the rules (deliver) nor for technology proposals (tech-watch).
argument-hint: "<what to record>"
---

# issue: one problem, recorded once the owner approved its text

What an issue is, a problem to solve, and when it becomes framed:
[`docs/WORKFLOW.md`](../../../docs/WORKFLOW.md) § Issues; its title: GIT-01. This skill only says how
the assistant records one. It never edits a file and never starts the work: recording ends with the
issue's link.

## 1. Duplicates first

Search before drafting (AGENTS-06): `gh issue list --state all --search "<keywords>"`, with two or
three wordings of the subject.

## 2. One round of questions

Pick the form that fits in [`.github/ISSUE_TEMPLATE/`](../../../.github/ISSUE_TEMPLATE/):
`problem.yml` for a need or an idea, `bug.yml` for a defect, `camera-report.yml` for what a camera
model did. Read it: its fields, its required ones, its title prefix and its labels. Ask, in one
message, only the required facts the request does not give, each with a suggested value drawn from
the request or the repository. A fact that is not required is left out, never asked in a second
round.

## 3. Draft, then record

```
Searched: <each search run> -- <the issues found, or none>

Draft, not recorded until you approve it
Kind: new issue (<form>) | comment on #<n>
Title: <title>
Labels: <the form's labels>
Body:
<one heading per field of the form, in its order, then the exact text>
```

Show it with the questions of § 2 when there are any. Once the owner approved that exact text
(AGENTS-05): `gh issue create --title "<title>" --label <label> --body-file <file>`, or
`gh issue comment <n> --body-file <file>`, then give the link.
