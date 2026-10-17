# Documentation rules

> Applies when: a file under `docs/` or `README.md` changes, or the change alters the need, a
> recorded decision or the system's shape. What each document is for:
> [`../WORKFLOW.md`](../WORKFLOW.md) § Document architecture.

## Order

### DOCS-01 · A change to the need updates the SPECS in the same branch

**Level**: Required · **Verified by**: Review

A user story, a journey, a rule or the product scope that changes is written in
[`SPECS.md`](../SPECS.md) before the code that delivers it, in the same pull request.

### DOCS-02 · A structural decision comes with its ADR in the same branch

**Level**: Required · **Verified by**: Review

A decision taken in code that meets the ADR bar (DOCS-07) and has no ADR is a finding. A decision
below the bar is not a missing ADR.

### DOCS-03 · A change to the system's shape updates the SAD in the same branch

**Level**: Required · **Verified by**: Review

Adding, removing or changing a container, an external system, a network flow (port, protocol,
direction, authentication), the ownership or retention of data, or a quality attribute. Look at the
compose files, the web server configuration, outbound clients, listeners and persisted data, not
only `docs/`.

### DOCS-04 · The code never contradicts an accepted ADR, the SAD or the SPECS

**Level**: Required · **Verified by**: Review

A change that would is preceded by the document's update, in the same branch. Search `docs/adr/` for
the subject, not only the files the diff touches.

## The SAD

### DOCS-05 · The SAD names no code

**Level**: Required · **Verified by**: Review

No class or type name, no file path, no organisation of the code (layers, folders, projects), no
constant copied from the code, no paraphrase of it.

**Exceptions**: the ports of the network flow matrix, which are the system's contract with the
network and are reviewed there.

### DOCS-06 · The SAD states the target, in the present tense

**Level**: Required · **Verified by**: Review

Never what was done before nor the road travelled.

## ADRs

### DOCS-07 · An ADR records a structural decision only

**Level**: Required · **Verified by**: Review

One is written only when reversing the decision costs a migration, a contract change, a new
container or a new dependency, or when it opens or closes a flow leaving the home network (privacy
first, ADR-70). An ADR never describes a state, a wording or a screen: that is the SPECS; what a
camera model does is its hardware sheet; the *how* is the code and its tests.

### DOCS-08 · An ADR states its target, its history only under "Options rejected"

**Level**: Required · **Verified by**: Review

Its title says the target ("X rejected, Y chosen"), not the history ("X attempted then abandoned").
Corrections are merged into the decision, never stacked as "Correction (a)(b)(c)". The format:
Context, Options compared, Decision, Consequences, Options rejected.

### DOCS-09 · An accepted ADR is frozen but for its status line

**Level**: Required · **Verified by**: Review

**Exceptions**: a link whose target no longer exists is fixed mechanically, repointed to the new
home of what it pointed at, or removed with the sentence that only pointed at it; a secret or
personal data published by mistake is replaced by a neutral value; a statement that contradicts the
delivered product is corrected in place, in the present tense.

### DOCS-10 · A superseded ADR is marked, never deleted

**Level**: Required · **Verified by**: Review

Its status becomes `superseded by ADR-NNNN`; the decision that replaces it summarises the abandoned
option under its own "Options rejected". The [index](../adr/README.md) is updated in the same change.

## Every document

### DOCS-11 · No document copies or paraphrases the code

**Level**: Required · **Verified by**: Review

A timeout, a port, a slot number, a topic, a schema, a signature, a byte frame, a route list: the
document names the behaviour, the code holds the value. An ADR names a value by its role, never by
its number.

**Exceptions**: the SAD's network flow matrix (DOCS-05); ADRs accepted before this rule, frozen as
they are.

### DOCS-12 · No document restates an ADR

**Level**: Required · **Verified by**: Review

It names the ADR (`ADR-NN`) and says at most in a few words what it settles.

### DOCS-13 · The DESIGN SYSTEM describes the design system only

**Level**: Required · **Verified by**: Review

Intent, tokens, components, reusable patterns, the shared UX vocabulary and the bans; never one
feature's behaviour, which is the SPECS or the code and its tests.

### DOCS-14 · Exploration and measurements go to their own folders

**Level**: Required · **Verified by**: Review

Trials, network captures and reverse engineering go to `investigations/`; what a camera model was
measured to do goes to its sheet under `hardware/`, dated, with no decision and no *how*.

### DOCS-15 · A document states its own role in its header

**Level**: Recommended · **Verified by**: Review
