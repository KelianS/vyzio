# Workflow and documentation governance

The source of truth for how work happens in this repository. Every significant change follows this
order; starting the implementation before the upstream documents are aligned is forbidden.

## Mandated order

1. **SPECS** ([`SPECS.md`](SPECS.md)) if the product need changes: user stories, journeys, product scope.
2. **ADR** ([`adr/`](adr/)) for a structural choice (§ Writing discipline), and the **SAD**
   ([`SAD.md`](SAD.md)) when the system's shape changes (§ The SAD).
3. **Issues** ([GitHub](https://github.com/KelianS/vyzio/issues)) for execution order, slicing,
   dependencies, definition of done. An issue leans on the documents above, it does not re-decide them.
4. **Implementation**, minimal code, consistent with the validated documents.
5. **Tests**, targeted validation of the modified slice, mandatory.
6. **Help inside the interface**: every deliverable feature is documented **in the screen that carries
   it**, across the three levels of
   [ADR-53](adr/0053-user-documentation-lives-in-the-interface-three-levels-of-help.md).
   No instructions for use outside the product.

## Practical rules

- A feature that changes neither the need, nor the architecture, nor the plan goes straight to
  implementation, then tests.
- A feature that contradicts an existing document means updating the document **before** writing code.
- The backlog is never where the strategy is discovered after the fact; it expresses a strategy already
  decided in the SPECS and the SAD.
- No pull request is clean when the code is up to date and the framing documentation lags behind.

## Document architecture (types of document)

| Type | Role | Home | Stability |
|---|---|---|---|
| **SPECS** | Need, journeys, product scope | [`SPECS.md`](SPECS.md) | medium |
| **Rules** | The constraints a diff is checked against, with their level and what verifies them | [`rules/`](rules/), routed by [`rules/README.md`](rules/README.md) | follows the code |
| **SAD** | The system overview, and what the code does not easily show (§ The SAD) | [`SAD.md`](SAD.md) | high |
| **ADR** | One structural decision per file (Context, Options, Decision, Consequences), within the bar of DOCS-07 | [`adr/`](adr/), one `NNNN-slug.md` per decision, index [`adr/README.md`](adr/README.md) | frozen once `accepted` |
| **Design system** | The dashboard's design system, never one feature (DOCS-13) | [`DESIGN SYSTEM.md`](DESIGN%20SYSTEM.md) | high |
| **Hardware sheet** | The raw measurements of one camera model, each dated; measurements only, no decision and no *how* | [`hardware/`](hardware/), one `.md` per model | grows with each measurement |
| **Investigation** | Exploration, trials, reverse engineering, captures | [`investigations/`](investigations/) | disposable |
| **User help** | How to use a delivered feature | the screen that carries it, in code (ADR-53) | follows the feature |

The chain: the SAD gives the **overview**, an ADR **settles** a decision (and states the options it
rejected), and the code and its tests carry the **how**: a one-line comment naming the ADR, a test
named after the scenario, or after the device model whose behaviour it pins. There is no document
level between the ADR and the code. Each has its own home, nothing is copied.

**Scaling rules:**
- The body of the SAD does not move when a decision is added: a new ADR is a file in `adr/` plus one
  index line. The SAD **points at** the index, it does not copy it.
- An accepted ADR is frozen (DOCS-09); a superseded one is marked, never deleted (DOCS-10).

## The SAD

**What it holds:** the quality attributes (the requirement, its architectural impact, the ADR that
answers it), the context and the containers (C4 levels 1 and 2), the network flows (source, direction,
destination, protocol, port, authentication), the significant scenarios (only the flows that reveal a
constraint), data ownership and retention, the deployment, the threat model, and the risks and open
questions, each linked to its issue. It describes the system as a whole and states what the code does
not easily show.

**What it never holds and when it must change:** DOCS-05, DOCS-06 and DOCS-03 of
[`rules/docs.md`](rules/docs.md).

## Writing discipline

Each document has a **nature**; respecting it is what stops it from swelling and going stale. The
rules that hold each document to its nature are [`rules/docs.md`](rules/docs.md).

## Precedence (one piece of information, one home)

Vision goes to [`../README.md`](../README.md) · the need to `SPECS.md` · the system overview to
`SAD.md` · a decision to its ADR · the execution plan to **the issues** · how to use a feature to
**the screen itself** (ADR-53).

Every document states its own role in its header (DOCS-15). When in doubt, climb to the right level: vision,
need, architecture, execution, use. Never copy information from one document into another (COMMON-05).

## Language

The repository is written in English, with the exceptions of COMMON-01: `SPECS.md`, what the
interface shows the user, and the bodies of the ADRs accepted in French until they are translated.

## Git

- Branches: `main`, stable and the target of every pull request; a work branch is named
  `<type>/<issue>-<slug>`, `type` being a commit type of GIT-01 (`feat/47-live-video-stream`).
- Pull requests: review and green tests are mandatory.

### Delivery gate, before a pull request is opened

1. `task check` is green (GIT-08). It runs the steps of the backend and frontend CI jobs; the image
   build and its Trivy scan stay CI-only.
2. The review agents of [`.claude/agents/`](../.claude/agents/) have run on the branch:
   `delivery-reviewer` always, `framing-guardian` when the change alters behaviour, architecture or
   `docs/`, `product-guardian` when it touches what a user sees or walks through. They judge against
   [`rules/`](rules/) and the product sources only, never against anyone's personal instructions.
3. Their blocking findings are fixed, not argued away in the pull request description.
4. A change to what the interface shows carries its screenshots (GIT-07), so the owner validates the
   screen without running the stack.

The [`deliver`](../.claude/skills/deliver/SKILL.md) skill runs this gate for the assistant: the
check, the reviewers in parallel, one merged report, a re-review on the delta, then the pull
request. A change to an agent, a skill or a rule page runs the cases of
[`tools/review-cases/`](../tools/review-cases/README.md) first. What is enforced beyond it is narrower: the tools `task check` runs, and
[`.claude/settings.json`](../.claude/settings.json), which denies the assistant merging and
force-pushing; only branch protection on `main` would deny it to everyone.

### Commits and pull requests, English and conventional

A commit and a pull request address the tooling and third parties, so they follow the language of
the code and the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) format:
[`rules/git.md`](rules/git.md). The **definition of done** lives in
[`pull_request_template.md`](../.github/pull_request_template.md), where it gets ticked.

### Issues, two templates and one state

The **title** is always English and conventional: it becomes the pull request title as it stands, then
the commit subject, written once and reused.

Two templates in [`.github/ISSUE_TEMPLATE/`](../.github/ISSUE_TEMPLATE/): **Feature** and **Bug**.

There is **no "idea" template**: an idea is a feature whose direction has not been settled yet, which
makes it a **state**, not a category. The issue is opened with the objective alone and the
`needs-framing` label; the SPECS or an ADR settle it; the rest is filled in and the label removed.
Nothing gets built while it is up, which is the mandated order above, made visible.

A template **reminds, it does not enforce**: GitHub imposes it neither on the web nor through
`gh issue create`. What would truly enforce the format is an integration check, and there is none.

### Releases, one milestone each

The next release is a GitHub **milestone** named after its version (`v0.3.0`); an issue in no
milestone is out of that release. Before work on a milestone starts, all its issues are framed in
**one batch**: the open questions are gathered and put to the owner together, each with its options
and a recommendation, so no product question comes back once the work has started. The
milestone starts once none of its issues still carries `needs-framing`.

## Technology watch

Dependabot proposes the version bumps it is configured for, weekly. What it cannot propose, a
package replaced under another name, an end of support, a deprecation, a major it is told to ignore,
a tool that would verify a rule, comes from the technology watch: on the owner's request, through
the [`tech-watch`](../.claude/skills/tech-watch/SKILL.md) skill. A proposal carries its fetched
evidence, its gain and its cost. Only the proposals the owner validates, in their exact text, become
issues, labelled `needs-framing` and `tech-watch`; they are then framed like any other.
