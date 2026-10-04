# Workflow and documentation governance

The source of truth for how work happens in this repository. Every significant change follows this
order; starting the implementation before the upstream documents are aligned is forbidden.

## Mandated order

1. **SPECS** ([`SPECS.md`](SPECS.md)) if the product need changes: user stories, journeys, product scope.
2. **ADR** ([`adr/`](adr/)) for an architectural choice, and the **SAD** ([`SAD.md`](SAD.md)) when the
   system's shape changes (§ The SAD).
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
| **SAD** | The system overview, and what the code does not easily show (§ The SAD) | [`SAD.md`](SAD.md) | high |
| **ADR** | One architectural decision per file (Context, Options, Decision, Consequences) | [`adr/`](adr/), one `NNNN-slug.md` per decision, index [`adr/README.md`](adr/README.md) | frozen once `accepted` |
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
- A superseded ADR is never deleted: its status becomes `superseded by ADR-NNNN`, and the decision
  that replaces it summarises the abandoned option under its own "Options rejected" heading.
- **An accepted ADR is frozen**: only its status line changes. Two exceptions: a link whose target no
  longer exists is fixed mechanically, repointed to the new home of what it pointed at, or removed
  with the sentence that only pointed at it; and a secret or personal data published by mistake is
  replaced by a neutral value. Nothing else in the ADR changes.

## The SAD

**What it holds:** the quality attributes (the requirement, its architectural impact, the ADR that
answers it), the context and the containers (C4 levels 1 and 2), the network flows (source, direction,
destination, protocol, port, authentication), the significant scenarios (only the flows that reveal a
constraint), data ownership and retention, the deployment, the threat model, and the risks and open
questions, each linked to its issue. It describes the system as a whole and states what the code does
not easily show.

**What it never holds:** a class or type name, a file path, the organisation of the code (layers,
folders, projects), a constant copied from the code, a paraphrase of the code, or a restated ADR: it
names the ADR instead. The ports of its network flow matrix are the one exception: they are the
system's contract with the network, and the matrix is where they are reviewed.

**When it must change:** a pull request that adds, removes or changes a container, an external system,
a network flow (port, protocol, direction, authentication), the ownership or retention of data, or a
quality attribute updates the SAD in the same pull request.

## Writing discipline (the nature of each document)

Each document has a **nature**; respecting it is what stops it from swelling and going stale.

- **A SAD is the target, not the history.** The SAD describes the **intended** architecture, in the
  present tense, never what was done before nor the road travelled. The one place where "what was done
  before" may appear is the **"Options rejected"** heading of an ADR, whose value is explaining *why
  not*. Forbidden: stacking chronological "Correction (a)(b)(c)..." entries in an ADR; merge them into
  the target decision. An ADR title states the target ("X rejected, Y chosen"), not the history ("X
  attempted then abandoned").
- **Do not paraphrase the code, in any document.** The SQL schema, signatures, byte frames, route lists
  and every tuned value have their home in the code. No document copies a code constant (a timeout, a
  port, a slot number, a topic): it names the behaviour, and the code holds the value. **An ADR
  decides with no code constant either**: a value is named by its role, never by its number. ADRs
  accepted before this rule stay frozen as they are.
- **Do not restate an ADR.** Any other document names the ADR (`ADR-NN`) and says at most in a few
  words what it settles; the decision itself is told once, in the ADR.
- **Exploration history** (trials, network captures, reverse engineering) goes to
  [`investigations/`](investigations/), never into the SAD. **What a camera model was measured to do**
  goes to its hardware sheet, dated; the code handles it, and a test named after that model pins it.

## Precedence (one piece of information, one home)

Vision goes to [`../README.md`](../README.md) · the need to `SPECS.md` · the system overview to
`SAD.md` · a decision to its ADR · the execution plan to **the issues** · how to use a feature to
**the screen itself** (ADR-53).

Every document states its own role in its header. When in doubt, climb to the right level: vision,
need, architecture, execution, use. Never copy information from one document into another, see the
supreme zero-duplication rule in [`../CLAUDE.md`](../CLAUDE.md).

## Language

**The repository is written in English**, code and prose alike: comments, commits, pull requests,
issues, templates, labels, and every framing document. Two things are French: [`SPECS.md`](SPECS.md),
because it frames the product for a French market and is read as much by non-engineers as by
contributors; and what the interface shows the user, wherever it is written, the strings of the
dashboard as well as the vendor sheets `src/vyzio/vendors/*.md`, which the interface serves as vendor
assistance.

One gap remains, and it is deliberate. The **bodies of the ADRs are still in French**, while their
filenames are already English. Renaming is the operation that breaks links, so it was done once, on its
own, ahead of any translation of the content. Until that translation lands, an existing ADR is read in
French. **A new ADR is written in English**, like everything else.

## Git

- Branches: `main` (stable), `dev` (integration), `feature/*` (work in progress).
- Pull requests: review and green tests are mandatory.

### Delivery gate, before a pull request is opened

1. `task check` is green. It runs the steps of the backend and frontend CI jobs; the image build and
   its Trivy scan stay CI-only.
2. The review agents of [`.claude/agents/`](../.claude/agents/) have run on the branch:
   `delivery-reviewer` always, `framing-guardian` when the change alters behaviour, architecture or
   `docs/`, `product-guardian` when it touches what a user sees or walks through.
3. Their blocking findings are fixed, not argued away in the pull request description.
4. A change to what the interface shows carries its screenshots in the pull request description: the
   screen after the change, and the same screen before it when an existing one changes, at the phone
   width the interface is designed for ([SPECS](SPECS.md) 7.2). The owner validates the screen
   without running the stack. They are shot on the fake backend of the e2e suite, never on a real
   installation, so they carry no footage and no credential. How:
   [`CONTRIBUTING.md`](../CONTRIBUTING.md) § Pull request screenshots.

The agents are instructions, not hooks: the gate holds because it is followed. What is enforced is
narrower: [`.claude/settings.json`](../.claude/settings.json) denies the assistant merging and
force-pushing, and only branch protection on `main` would deny it to everyone.

### Commits and pull requests, English and conventional

A commit and a pull request address the tooling and third parties rather than the framing documents, so
they follow the language of the code, **English**, and the [Conventional
Commits](https://www.conventionalcommits.org/en/v1.0.0/) format: subject, body, pull request title and
description alike.

```
type(scope): imperative subject, lowercase, no trailing period (72 characters or fewer)

The body says the *why*: what the diff does not show. A blank line separates
it from the subject. ASCII only.

Co-Authored-By: ...
```

- **type**: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `chore`. A breaking change is
  written `type(scope)!: ...`.
- **scope**: the subject touched, optional but preferred: `api`, `dashboard`, `access`, `onboarding`,
  `recording`. Exactly one, the one that carries the change. **The scope carries the theme**: there is
  no theme label, the grouping reads from the title and is searched through it.
- **subject**: the effect obtained, not the mechanism used. What it changes for whoever reads it, never
  "adds an X method".
- **pull request**: title in the same format as a commit subject, description in English, saying the
  *why*, the scope, and what was verified. Template:
  [`pull_request_template.md`](../.github/pull_request_template.md), which also carries the
  **definition of done**, whose home is there, where it gets ticked.

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
