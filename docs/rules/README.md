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
- A case no rule settles is not a finding: it is feedback on the rules (§ Feedback below), never
  an invented rule.

## Feedback on the rules

A reviewer reports what got in its way, with its proof, and nothing else:

| Type | When |
| --- | --- |
| **Missing** | No rule settles a case of the diff |
| **Unclear** | A rule reads two ways for a case of the diff |
| **Doubtful** | A rule goes against a recognised reference (Microsoft, React, an RFC, OWASP) |
| **Tooling** | An instruction of an agent or a skill failed or did not match reality |

The rules keep the last word: a doubtful rule still applies, the feedback asks for it to be
reexamined. Only once the owner has validated its text does it become a GitHub issue labelled
`agent-feedback`, titled `[rules] <page> § <ID>` or `[agents] <agent or skill>`; an open issue on
the same subject gets a comment instead.

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
routing does not name, or an ID cited anywhere in the repository that does not exist. CI runs it.
