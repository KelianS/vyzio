# Git rules

> Applies when: a commit is written or a pull request is opened or updated, whatever its files.

### GIT-01 · A commit subject and a pull request title follow Conventional Commits

**Level**: Required · **Verified by**: Review

`type(scope): subject`, in English, imperative, lowercase, no trailing period, 72 characters or
fewer. `type` is one of `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `chore`; a
breaking change is written `type(scope)!: ...`.

### GIT-02 · The scope is the one subject the change carries

**Level**: Recommended · **Verified by**: Review

Exactly one: `api`, `dashboard`, `access`, `onboarding`, `recording`... There is no theme label: the
grouping reads from the title and is searched through it.

### GIT-03 · The subject states the effect, not the mechanism

**Level**: Recommended · **Verified by**: Review

What it changes for whoever reads it, never "adds an X method".

### GIT-04 · A commit body says the why, in ASCII

**Level**: Recommended · **Verified by**: Review

What the diff does not show, after a blank line.

### GIT-05 · A pull request description follows its template

**Level**: Required · **Verified by**: Review

[`pull_request_template.md`](../../.github/pull_request_template.md): the why, the scope, what was
actually run with its result, and the definition of done ticked from what the diff shows, a line
that does not apply struck through with its reason.

### GIT-06 · A pull request description matches its last commit

**Level**: Required · **Verified by**: Review

A commit that changes the scope, a behaviour or a screen updates the description and its
screenshots.

### GIT-07 · A change to what the interface shows carries its screenshots

**Level**: Required · **Verified by**: Review

The screen after the change, and the same screen before it when an existing one changes, at the
phone width the interface is designed for ([SPECS](../SPECS.md) 7.2), shot on the fake backend of the
e2e suite. How: [`CONTRIBUTING.md`](../../CONTRIBUTING.md) § Pull request screenshots.

### GIT-08 · `task check` is green before the pull request opens

**Level**: Required · **Verified by**: Tool: `task check` locally, the CI workflows on the pull request
