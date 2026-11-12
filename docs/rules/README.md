# Rules

The rules a change is checked against, by whoever writes it and whoever reviews it, human or agent.
One entry point: read the routing below, then only the pages it names. How work flows (order,
gate, issues, releases) is [`../WORKFLOW.md`](../WORKFLOW.md); this folder holds what a diff must
respect.

## Routing

Every changed file names one or more pages, by its path or its extension. Every pull request also
names [`git.md`](git.md).

| Changed files | Pages |
| --- | --- |
| Any pull request | [`git.md`](git.md) |
| Any file of the repository | [`common.md`](common.md) |
| `src/vyzio/**`: `*.cs`, `*.csproj`, `*.props`, `*.slnx`, `.editorconfig` | [`backend.md`](backend.md) |
| `src/dashboard/**`: `*.ts`, `*.tsx`, `*.css`, `eslint.config.js`, `vite.config.ts`, `knip.jsonc` | [`dashboard.md`](dashboard.md) |
| `docs/**`, `README.md`, or a change to the system's shape: compose files, `nginx.conf`, a listener, an outbound client, persisted data | [`docs.md`](docs.md) |
| `.claude/**`, `tools/review-cases/**`, `docs/rules/**` | [`agents.md`](agents.md) |

A page opens with the line saying when it applies; within a page, read the rules that can apply
to the change.

## Reading a rule

A rule is a constraint that can be checked in a diff, under a heading `### <PAGE>-<NN> · <the
constraint>`, followed by its level and what verifies it.

| Level | A breach is |
| --- | --- |
| **Required** | **blocking**: fixed before the pull request |
| **Recommended** | **worth fixing**: fixed, or dismissed with its reason in the pull request |

| Verified by | What a review does |
| --- | --- |
| `Review` | It reads the change and judges |
| `Tool: <tool>` | It does not hunt for breaches in the code: `task check` and CI do. It checks that the tool is still in place and not weakened (COMMON-07), and that `task check` is green |

- Only what the change adds or modifies is judged. Code written before a rule is not a model, and
  not a finding either, unless the change touches it.
- A rule is cited by its ID, which gives its place: `BACKEND-07` is rule 07 of `backend.md`.
- A case no rule settles is not a finding: it is feedback on the rules (§ Feedback on the rules
  below), never an invented rule.

## Feedback on the rules

A reviewer reports what got in its way, with its proof, and nothing else; feedback without the
proof its type requires is not reported:

| Type | When | Proof required |
| --- | --- | --- |
| **Missing** | No rule settles a case of the diff | The `path:line` of the case, and what a rule would have to settle |
| **Unclear** | A rule reads two ways for a case of the diff | The rule ID, the `path:line` of the case, and the two readings |
| **Doubtful** | A rule goes against a recognised reference (Microsoft, React, an RFC, OWASP) | The rule ID, and the reference's URL with what it says |
| **Tooling** | An instruction of an agent or a skill failed or did not match reality | The instruction (`file:line`), what was run, and what came out |

The rules keep the last word: a doubtful rule still applies, the feedback asks for it to be
reexamined. Once the owner has validated its text (AGENTS-05), it becomes a GitHub issue labelled
`agent-feedback`, titled `[rules] <page> § <ID>`, `[rules] <topic>` for a missing rule with no page,
or `[agents] <agent or skill>`, or a comment on an open issue on the same subject (AGENTS-06).

## Writing a rule

- **A tool first.** Before writing a rule, ask whether a linter, an analyzer, a test or a threshold
  can verify it. If one can, configure it and name it in `Verified by`. A rule left to review is
  kept for what needs judgement.
- **One constraint per heading**, in the present tense, understandable without the page. Two
  constraints that can be kept apart make two rules.
- **The body**: what is required in one to three sentences, `Why:` in one line when it is not
  obvious, `Exceptions:` when there are any (a case not listed is not one), the shortest `✗` / `✓`
  example when it helps.
- **The target only**: no date, no history, no "used to". A rule changes in place, Git keeps the rest.
- **IDs are never recycled.** A new rule takes the number after the highest ever given in its page;
  a deleted rule leaves its number dead; a rule whose meaning changes takes a new number. A rule that
  moves to another page takes an ID there, and its citations are fixed in the same change.
- A rule goes on the most general page where it stays true: `common.md` when it holds for the backend
  and the dashboard alike, only the example changing.

`task rules:check` fails on a malformed or duplicated ID, a rule without its level line, a page the
routing does not name, or an ID cited anywhere in the repository that does not exist; it holds the
SPECS and its use cases to DOCS-17, and to the citations of DOCS-19, the same way, and the ADRs to
DOCS-23 and DOCS-24. CI runs it.
