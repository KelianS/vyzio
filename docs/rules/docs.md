# Documentation rules

> Applies when: a file under `docs/` or `README.md` changes, or the change alters the need, a
> recorded decision or the system's shape. What each document is for:
> [`../WORKFLOW.md`](../WORKFLOW.md) § Document architecture.

## Order

### DOCS-01 · A change to the need updates the SPECS or its use cases in the same branch

**Level**: Required · **Verified by**: Review

A user story, a journey, a rule, a service level or the product scope that changes is written in
[`SPECS.md`](../SPECS.md) or in its use case under [`uc/`](../uc/) before the code that delivers
it, in the same pull request.

**Exceptions**: a docs branch the implementation pull request is stacked on (DOCS-24).

### DOCS-02 · A structural decision comes with its ADR in the same branch

**Level**: Required · **Verified by**: Review

A decision taken in code that meets the ADR bar (DOCS-07) and has no ADR is a finding. A decision
below the bar is not a missing ADR.

**Exceptions**: a docs branch the implementation pull request is stacked on (DOCS-24).

### DOCS-03 · A change to the system's shape updates the SAD in the same branch

**Level**: Required · **Verified by**: Review

Adding, removing or changing a container, an external system, a network flow (port, protocol,
direction, authentication), the ownership or retention of data, or a quality attribute. Look at the
compose files, the web server configuration, outbound clients, listeners and persisted data, not
only `docs/`.

**Exceptions**: a docs branch the implementation pull request is stacked on (DOCS-24).

### DOCS-04 · The code never contradicts an ADR, the SAD, the SPECS or a use case

**Level**: Required · **Verified by**: Review

A change that would is preceded by the document's update, in the same branch. Search `docs/adr/` for
the subject, not only the files the diff touches.

**Exceptions**: a docs branch the implementation pull request is stacked on (DOCS-24).

### DOCS-24 · Framing never reaches `main` ahead of the code that delivers it

**Level**: Required · **Verified by**: Review

An approved change to the SPECS, a use case, an ADR or the SAD merges with the code that delivers
it: as the first commit of the implementation branch, in its pull request, or on a docs branch
whose pull request targets `main` while the implementation pull request targets that docs branch,
the implementation merged first so the two reach `main` together. A pull request to `main` that
changes these documents for behaviour it does not deliver, with no implementation merged into it,
is a finding.

Why: `main` never describes a behaviour that is not implemented.

**Exceptions**: a document change that delivers no behaviour (a wording, a correction, a
reorganisation).

## The SPECS, the use cases and the SAD

### DOCS-16 · The SPECS, the use cases and the SAD state the target, never its history or its delivery

**Level**: Required · **Verified by**: Review

What the product does and how the system is shaped, in the present tense: no date, no delivery
status ("not delivered", "à venir", "pour l'instant"), no issue number standing for a behaviour,
never what was done before nor the road travelled. What is delivered and when lives in its issue or
milestone; the road travelled, in Git or under the "Options rejected" of an ADR (DOCS-08).

Why: a date or a status ages in silence and duplicates the issue that carries it.

**Exceptions**: the SAD's risks and open questions, each linked to its issue
([`../WORKFLOW.md`](../WORKFLOW.md) § The SAD).

### DOCS-17 · A requirement is cited by its identifier, never by a section number

**Level**: Required · **Verified by**: Tool: `task rules:check`

A rule or service level of the SPECS, a use case, a path or a local rule is cited by the identifier
it carries (`CAM-16`, `UC-CAM-04`, `UC-CAM-04 E1`), and only an identifier that exists is cited.
The identifiers and their domains: [`SPECS.md`](../SPECS.md) § Identifiants.

### DOCS-18 · A requirement identifier is never recycled

**Level**: Required · **Verified by**: Review

A new requirement takes the number after the highest ever given in its domain, the SPECS and the
use cases together; a deleted one leaves its number dead; one whose meaning changes takes a new
number, and its citations are fixed in the same change.

### DOCS-19 · A behaviour lives in one place: the SPECS or one use case

**Level**: Required · **Verified by**: Review

A rule that holds for the whole product, or that the SPECS or more than one use case cites, and
every service level, live in the SPECS; a journey and a rule only it needs live in its use case, written to
[`uc/TEMPLATE.md`](../uc/TEMPLATE.md). A use case cites a rule of the SPECS, it never restates it.

### DOCS-20 · A service level states a measurable target

**Level**: Required · **Verified by**: Review

A timing or a quantity promised to the user that could regress unnoticed in a code review is a row
of the SPECS' service levels, with a value and its unit, never "about a second"; a rule or a use
case cites that row. Any other value lives in the code alone and is not restated (COMMON-05).

## The SAD

### DOCS-05 · The SAD names no code

**Level**: Required · **Verified by**: Review

No class or type name, no file path, no organisation of the code (layers, folders, projects), no
constant copied from the code, no paraphrase of it.

**Exceptions**: the ports of the network flow matrix, which are the system's contract with the
network and are reviewed there.

## ADRs

### DOCS-07 · An ADR records a structural decision only

**Level**: Required · **Verified by**: Review

One is written only when reversing the decision costs a migration, a contract change, a new
container or a new dependency, or when it opens or closes a flow leaving the home network (privacy
first, ADR-03). An ADR never describes a state, a wording or a screen: that is the SPECS or a use
case; what a camera model does is its hardware sheet; the *how* is the code and its tests.

### DOCS-08 · An ADR states its target, its history only under "Options rejected"

**Level**: Required · **Verified by**: Review

Its title says the target ("X rejected, Y chosen"), not the history ("X attempted then abandoned").
Corrections are merged into the decision, never stacked as "Correction (a)(b)(c)". The format is
the one of [`adr/TEMPLATE.md`](../adr/TEMPLATE.md).

### DOCS-21 · An ADR is rewritten to its new target, never amended by another

**Level**: Required · **Verified by**: Review

When the decision it records moves, the ADR is rewritten in the same branch as the change, in the
present tense, and the option it leaves goes under its "Options rejected" (DOCS-08). No "amended
by", no correction stacked at its end, no ADR written only to amend another.

### DOCS-22 · A replaced or merged ADR is deleted, its citations repointed

**Level**: Required · **Verified by**: Review

The ADR that takes the decision over summarises it under its own "Options rejected"; the old file
is deleted, every citation of its number is repointed to the ADR that now holds the decision, and
the [index](../adr/README.md) is updated, in the same change. Git keeps the history.

### DOCS-23 · ADRs are numbered from ADR-01 with no gap

**Level**: Required · **Verified by**: Tool: `task rules:check`

A new ADR takes the next number; when one is deleted, the last ADR takes its number (DOCS-22 then
applies to both). Each number is held by one file.

### DOCS-25 · Every ADR is indexed, and only an existing ADR is cited

**Level**: Required · **Verified by**: Tool: `task rules:check`

Each ADR has its line in the [index](../adr/README.md); a document or a comment cites an ADR
number only while its file exists.

## Every document

### DOCS-11 · No document copies or paraphrases the code

**Level**: Required · **Verified by**: Review

A timeout, a port, a slot number, a topic, a schema, a signature, a byte frame, a route list: the
document names the behaviour, the code holds the value. An ADR names a value by its role, never by
its number.

**Exceptions**: the SAD's network flow matrix (DOCS-05); the service levels of the SPECS, the
target the code must meet (DOCS-20).

### DOCS-12 · No document restates an ADR

**Level**: Required · **Verified by**: Review

It names the ADR (`ADR-NN`) and says at most in a few words what it settles.

### DOCS-13 · The DESIGN SYSTEM describes the design system only

**Level**: Required · **Verified by**: Review

Intent, tokens, components, reusable patterns, the shared UX vocabulary and the bans; never one
feature's behaviour, which is the SPECS, a use case, or the code and its tests.

### DOCS-14 · Exploration and measurements go to their own folders

**Level**: Required · **Verified by**: Review

Trials, network captures and reverse engineering go to `investigations/`; what a camera model was
measured to do goes to its sheet under `hardware/`, dated, with no decision and no *how*.

### DOCS-15 · A document states its own role in its header

**Level**: Recommended · **Verified by**: Review
