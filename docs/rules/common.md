# Common rules

> Applies when: any file of the repository changes, code, tests, scripts and documents alike.

## Writing

### COMMON-01 · The repository is written in English

**Level**: Required · **Verified by**: Review

Code, comments, test names, log and exception messages, commits, pull requests, issues, labels,
templates and framing documents are in English.

**Exceptions**: `docs/SPECS.md`, which frames the product for a French market and is read by
non-engineers; what the interface shows the user, wherever it is written: the dashboard strings and
the vendor sheets `src/vyzio/vendors/*.md` served as vendor assistance; the bodies of the ADRs
accepted while they were written in French, read as they are until translated. A new ADR is English.

### COMMON-02 · A comment holds on one line

**Level**: Recommended · **Verified by**: Review

A comment says what the code cannot: the non-deducible *why*. If it needs more than a line, the
explanation belongs in an ADR, and the comment names it.

### COMMON-03 · A comment carries no story

**Level**: Required · **Verified by**: Review

No history, no commit hash, no incident told, no "used to": they age in silence and duplicate the
ADR. An ADR reference is welcome: `(ADR-44)`.

```csharp
// ✗ Moved here after the retry storm of the v0.2 hub, see 3e5fcf8.
// ✓ Bounded so a camera that never answers cannot hold the probe loop (ADR-23).
```

### COMMON-04 · A business value is never compared with a string literal

**Level**: Required · **Verified by**: Review

Backend: an `enum` of `Vyzio.Core.Entities`, compared or switched on, converted at the API
boundary through `SnakeCaseEnum.ToSnakeCase` / `TryFromSnakeCase` (`Vyzio.Core.Common`), never a
hardcoded string on either side. Dashboard: a literal union, read through an exhaustive `switch`
(with a `default: { const _x: never = ... }` branch) or a `Record<Union, T>` table; an error's kind
through `AppErrorKind`.

```ts
// ✗
if (settings.irCut !== 'auto') { ... }
// ✓
const LABEL: Record<IrCutMode, string> = { auto: '…', on: '…', off: '…' }
```

### COMMON-05 · A piece of information has one home

**Level**: Required · **Verified by**: Review

Everywhere else it is referenced, never copied: a code constant is not restated in a document, an
ADR is named rather than retold, a rule is cited by its ID. A brief summary that cites its source
is the one tolerance.

## Tooling

### COMMON-06 · A tool bypass is local and says why

**Level**: Required · **Verified by**: Review

An `eslint-disable`, a `#pragma warning disable`, a `[SuppressMessage]` or an analyzer severity
lowered in `.editorconfig` targets one line or one scope, and carries its reason on the same line
or the one above.

```ts
// ✗
// eslint-disable-next-line react-hooks/exhaustive-deps
// ✓
// eslint-disable-next-line react-hooks/exhaustive-deps -- built once; the context is stable
```

### COMMON-07 · The verification tools are never weakened to pass

**Level**: Required · **Verified by**: Review

A change does not loosen what `task check` and CI enforce to get green: a lint rule, an analyzer
level or `TreatWarningsAsErrors`, a coverage threshold or exclude, a knip ignore, a formatter
ignore, a CI step, a test turned off. A layering error is fixed by routing the dependency through a
port or the container, never by silencing the rule.

**Exceptions**: a change that makes a tool stricter, or one the owner decided, with its reason in
the pull request.

### COMMON-08 · Nothing that nothing reaches is kept

**Level**: Required · **Verified by**: Review

The change that orphans code removes it: a flag nothing reads, a member nothing calls, a branch for
an option that was not retained. On the dashboard the tool does it (DASHBOARD-32).

### COMMON-09 · No secret, credential or footage enters the repository

**Level**: Required · **Verified by**: Review

Not in code, fixtures, logs, screenshots or documents: a camera password, a token, an RTSP URL with
its credentials, an image from a real installation. Fixtures use neutral values; screenshots come
from the fake backend of the e2e suite.

## Tests

### COMMON-10 · A test is named `{Subject}_Should{Effect}_When{Condition}`

**Level**: Required · **Verified by**: Tool: `TestNamingTests` (backend), ESLint `test-names/convention` (dashboard)

PascalCase after the subject, in xUnit as in Vitest and Playwright, so a CI failure reads without
opening the test. A parametrised name may end with its parameters in brackets: `... (%i options)`.
The lint reads the static part of a parametrised name; a name drawn wholly from the table rows
(`'$name'`) is checked in review.

### COMMON-11 · A test name tells a functional scenario

**Level**: Required · **Verified by**: Review

Someone who knows the domain but not the code understands it: the subject, the effect the user or
the caller gets, the condition. Never the mechanism.

```text
✗ Reducer_ShouldSetFlag_WhenActionDispatched
✓ CameraList_ShouldShowTheCameraAsOffline_WhenItStopsAnswering
```

### COMMON-12 · A test reads Arrange, Act, Assert, with the three comments

**Level**: Required · **Verified by**: Review

`// Arrange`, `// Act`, `// Assert`, merged as `// Arrange & Act` when the setup is the action.

**Exceptions**: e2e tests read top to bottom.

### COMMON-13 · A test holds at least one assertion

**Level**: Required · **Verified by**: Review

### COMMON-14 · A test holds no logic

**Level**: Required · **Verified by**: Review

No loop, no condition, no computed expectation: hardcoded values only. Several inputs for one
assertion make a parametrised test (`[Theory]`, `it.each`).

### COMMON-15 · A behaviour change brings a test that fails without it

**Level**: Required · **Verified by**: Review

Reverting the change must make a test fail. A bug fix brings the test that reproduces the defect.
