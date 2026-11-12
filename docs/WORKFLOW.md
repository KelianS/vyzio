# Workflow and documentation governance

The source of truth for how work happens in this repository. Every significant change follows this
order; starting the implementation before the upstream documents are aligned is forbidden.

## Mandated order

1. **SPECS and use cases** if the product need changes: the cross-cutting rules, service levels,
   capability catalogue and product scope in [`SPECS.md`](SPECS.md), each user goal and its journeys
   in its use case under [`uc/`](uc/) (DOCS-19).
2. **ADR** ([`adr/`](adr/)) for a structural choice (§ Writing discipline), and the **SAD**
   ([`SAD.md`](SAD.md)) when the system's shape changes (§ The SAD).
3. **Issues** ([GitHub](https://github.com/KelianS/vyzio/issues)) for execution order, slicing,
   dependencies, and, once framed, the observable behaviour that closes each (§ Issues). An issue
   leans on the documents above, it does not re-decide them.
4. **Implementation**, minimal code, consistent with the validated documents.
5. **Tests**, targeted validation of the modified slice, mandatory.
6. **Help inside the interface**: every deliverable feature is documented **in the screen that carries
   it**, across the three levels of
   [ADR-53](adr/0053-user-documentation-lives-in-the-interface-three-levels-of-help.md).
   No instructions for use outside the product.

## Practical rules

- A feature that changes neither the need, nor the architecture, nor the plan goes straight to
  implementation, then tests.
- A feature that contradicts an existing document updates the document first, in the same branch
  (DOCS-01 to DOCS-04).
- The backlog is never where the strategy is discovered after the fact; it expresses a strategy already
  decided in the SPECS, its use cases and the SAD.

## Document architecture (types of document)

| Type | Role | Home | Stability |
|---|---|---|---|
| **SPECS** | The need for the whole product: overview, cross-cutting rules, service levels, capability catalogue, scope, index of the use cases | [`SPECS.md`](SPECS.md) | medium |
| **Use case** | One user goal: its actor, conditions, nominal, alternative and failure paths, and the rules only it needs | [`uc/`](uc/), one `<domain>-<nn>-<slug>.md` per goal, written to [`uc/TEMPLATE.md`](uc/TEMPLATE.md) | medium |
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

**What it never holds and when it must change:** DOCS-05, DOCS-16 and DOCS-03 of
[`rules/docs.md`](rules/docs.md).

## Writing discipline

Each document has a **nature**; respecting it is what stops it from swelling and going stale. The
rules that hold each document to its nature are [`rules/docs.md`](rules/docs.md).

## Precedence (one piece of information, one home)

Vision goes to [`../README.md`](../README.md) · the need to `SPECS.md` and its use cases · the
system overview to `SAD.md` · a decision to its ADR · the execution plan to **the issues** · how to
use a feature to **the screen itself** (ADR-53).

Every document states its own role in its header (DOCS-15). When in doubt, climb to the right level: vision,
need, architecture, execution, use. Never copy information from one document into another (COMMON-05).

## Language

The repository is written in English, with the exceptions of COMMON-01: `SPECS.md` and its use
cases, what the interface shows the user, and the bodies of the ADRs accepted in French until they
are translated.

## Git

- Branches: `main`, stable and the target of every pull request; a work branch is named
  `<type>/<issue>-<slug>`, `type` being a commit type of GIT-01 (`feat/47-live-video-stream`).
- Pull requests: review and green tests are mandatory. CI's `ci-ok` job sums up every other job,
  security scans included ([`SECURITY.md`](../SECURITY.md) § What runs on every change), and is
  the check the ruleset of `main` requires. A pull request that changes only documentation runs
  no build, test or scan job (the `changes` job of [`ci.yml`](../.github/workflows/ci.yml)).

### Delivery gate, before a pull request is opened

1. `task check` is green (GIT-08). It runs the steps of the rules, backend and frontend CI jobs; the
   image build and its Trivy scan stay in CI and the release.
2. The review agents of [`.claude/agents/`](../.claude/agents/) have run on the branch:
   - `delivery-reviewer` always;
   - `framing-guardian` when the change alters a behaviour or the architecture, or touches `docs/`,
     `README.md`, a compose file, `nginx.conf`, an endpoint, a migration, a listener or an outbound
     client; in doubt, it runs;
   - `product-guardian` when it touches what a user sees or walks through: the screens and shared
     components of the dashboard, a user-facing string, a notification, the vendor sheets.

   They judge against [`rules/`](rules/) and the product sources only, never against anyone's
   personal instructions.
3. Their blocking findings are fixed, not argued away in the pull request description.
4. A change to what the interface shows carries its screenshots (GIT-07), so the owner validates the
   screen without running the stack.

The [`deliver`](../.claude/skills/deliver/SKILL.md) skill runs this gate for the assistant: the
check, the reviewers in parallel, one merged report, a re-review on the delta, then the pull
request. A change to an agent, a skill or a rule page runs the cases of
[`tools/review-cases/`](../tools/review-cases/README.md) first (AGENTS-08). What is enforced beyond it is narrower: the tools `task check` runs, and
[`.claude/settings.json`](../.claude/settings.json), which denies the assistant merging and
force-pushing; only branch protection on `main` would deny it to everyone.

### Commits and pull requests, English and conventional

A commit and a pull request address the tooling and third parties, so they follow the language of
the code and the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) format:
[`rules/git.md`](rules/git.md). The **definition of done** lives in
[`pull_request_template.md`](../.github/pull_request_template.md), where it gets ticked.

### Issues, a problem to solve

The **title** is always English and conventional: it becomes the pull request title as it stands, then
the commit subject, written once and reused.

An issue is a **problem to solve**, never the expected implementation: months later it still says
why the work was done, and whoever implements it stays free to find a better way. It has two kinds,
which are two moments of the same issue:

- **Problem**: the need or the defect, and the facts observed. It carries `needs-framing` while its
  direction is not settled, and never a technical definition of done.
- **Framed**: once the SPECS, a use case or an ADR settle the direction, the issue links them, and
  its **Done when** lists the observable behaviours that close it, each in **Given / When / Then**, never
  a technical task list. The `needs-framing` label is removed; nothing gets built while it is up,
  which is the mandated order above, made visible.

In both, **leads** are welcome, under their own heading, as leads: never the expected implementation.

The forms of [`.github/ISSUE_TEMPLATE/`](../.github/ISSUE_TEMPLATE/) open a problem: a need, a bug,
or a camera report, whose observed facts feed the model's sheet under [`hardware/`](hardware/)
(DOCS-14). An idea is a need whose direction is not settled yet: a state, not another form.

On the web, a form makes its required fields mandatory; `gh issue create` bypasses it. What would
enforce the shape of a framed issue is an integration check, and there is none.

### Releases, one milestone each

The next release is a GitHub **milestone** named after its version (`v0.3.0`); an issue in no
milestone is out of that release. Before work on a milestone starts, all its issues are framed in
**one batch**: the open questions are gathered and put to the owner together, each with its options
and a recommendation, so no product question comes back once the work has started. The
milestone starts once none of its issues still carries `needs-framing`. The
[`frame`](../.claude/skills/frame/SKILL.md) skill runs this framing for the assistant, and the
[`issue`](../.claude/skills/issue/SKILL.md) skill records a new issue.

## Technology watch

Dependabot proposes the version bumps it is configured for, weekly. What it cannot propose, a
package replaced under another name, an end of support, a deprecation, a major it is told to ignore,
a tool that would verify a rule, comes from the technology watch: on the owner's request, through
the [`tech-watch`](../.claude/skills/tech-watch/SKILL.md) skill. A proposal carries its fetched
evidence, its gain and its cost. Only the proposals the owner validates become issues (AGENTS-05),
labelled `needs-framing` and `tech-watch`; they are then framed like any other.
