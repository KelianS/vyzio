---
name: deliver
description: Runs the delivery gate of docs/WORKFLOW.md on the current branch, then opens its pull request on GitHub. Use when the user asks to review their branch or changes, to re-run the review after fixes, to open or update the pull request, or to record the reviewers' feedback on the rules.
argument-hint: review | pr | feedback
---

# deliver: the delivery gate, then the pull request

The gate itself, and when each reviewer runs, is [`docs/WORKFLOW.md`](../../../docs/WORKFLOW.md)
§ Delivery gate; the rules are [`docs/rules/`](../../../docs/rules/README.md). This skill only says
how the assistant runs them. Never merge, never push to `main`.

## 1. Check

Run `task check`. Red → stop, report the failing step, and fix it if the code is yours from this
session; the review starts on a green branch.

## 2. Review

Pick the reviewers from the diff (`git diff --stat origin/main...HEAD`):

| Reviewer | When |
| --- | --- |
| `delivery-reviewer` | always |
| `framing-guardian` | the diff touches `docs/`, `README.md`, a compose file, `nginx.conf`, an endpoint, a migration, a listener or an outbound client, or changes a behaviour; in doubt, run it |
| `product-guardian` | the diff touches what a user sees or walks through: `src/dashboard/src/presentation/`, `src/dashboard/src/common/components/`, a user-facing string, a notification, `src/vyzio/vendors/*.md` |

Launch them **in parallel**, in one message. The request to each carries the target only: the base
(`origin/main`), the commit range for a re-review, the issue number, and whether `task check` was
green. Never a rule, a preference or an instruction of the user: the review must be the same
whoever runs it.

## 3. One report

```
Review on `<short sha>`: PASS | BLOCKING · <n> blocking · <n> worth fixing · <n> uncertainties

| # | Severity | Reviewer | Where | Finding -> fix | Rule |
| --- | --- | --- | --- | --- | --- |

For the owner (product-guardian): contradictions, tensions, questions, one line each.
Behaviour changes to state in the pull request: one bullet each.
Uncertainties: one line each.
Main agent's view: one line per finding it disputes, only if any; it does not change the verdict.
```

Findings as the reviewers wrote them, sorted by severity. `BLOCKING` if delivery-reviewer or
framing-guardian says so; product-guardian gives no verdict, its points go to the owner.

- `BLOCKING` → **stop** and present the report: the user decides what gets fixed. One exception: the
  code was written in this session and a fix involves no choice (no option to settle, no change of
  behaviour or scope); fix those alone, re-review on the delta, and list what was fixed.
- Present every finding, worth fixing included, with its fix. Never drop a fix to avoid a re-review.

## 4. Re-review on the delta

Only when the user asks, or after the fixes of the exception above. The delta runs from the last
commit reviewed `PASS` (`<sha>..HEAD`); no `PASS` yet → the whole branch.

| The delta | Re-review |
| --- | --- |
| touches only tests, comments or dead code, or applies a reviewer's fix as proposed | `delivery-reviewer` alone, on the delta |
| changes a behaviour | the reviewers of § 2, on the delta |
| comes from a rebase or a merge of `main` | the reviewers of § 2, on the whole branch |

## 5. Feedback on the rules

Gather the reviewers' feedback, duplicates merged, and show it. **Record nothing without the user's
explicit agreement**, item by item or as a whole. For each accepted item:

1. Search an open issue on the subject: `gh issue list --label agent-feedback --search "<page or agent>"`.
2. Found → `gh issue comment`: the type, the branch, the finding, its proof.
3. Otherwise → `gh issue create --label agent-feedback`, titled `[rules] <page> § <ID>` (a missing rule
   with no page: `[rules] <topic>`) or `[agents] <agent or skill>`; the body gives the first case and
   what the rule or the instruction should settle. The label missing → create it once with
   `gh label create agent-feedback`.
4. List what was created or commented, with the links.

## 6. Open the pull request

Only on the user's request, and only after a `PASS` on the last commit.

1. Push the branch (`git push -u origin <branch>`); never `main`, never forced.
2. Title: the issue's title as it stands, otherwise per GIT-01.
3. Body from [`.github/pull_request_template.md`](../../../.github/pull_request_template.md), written to a
   file and passed with `gh pr create --base main --body-file <file>`:
   - **Why**: the effect obtained and for whom, the behaviour changes of the report included;
   - **Scope**: `Closes #<issue>`;
   - **Checked**: `task check` green, the review verdict and its sha, anything else actually run;
   - **Screenshots**: GIT-07, shot with `task pr:capture` then published with `task pr:screenshots`
     ([`CONTRIBUTING.md`](../../../CONTRIBUTING.md) § Pull request screenshots); no screen changed →
     the heading struck through with the reason;
   - **Definition of done**: ticked only from what the diff shows, a line that does not apply struck
     through with its reason.
4. A later commit that changes the scope, a behaviour or a screen → update the body and the
   screenshots (GIT-06), on request.
