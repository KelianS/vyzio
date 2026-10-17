# Dashboard rules

> Applies when: a file under `src/dashboard/` changes, tests and configuration included.

These are conventions: they hold for any screen, present or future, and name no screen in particular.

## Layers

### DASHBOARD-01 · Dependencies point inward, to `domain`

**Level**: Required · **Verified by**: Tool: ESLint `boundaries/dependencies`

`infrastructure -> domain <- presentation`. `common` is a shared kernel importable from anywhere, and
may read `domain` types.

### DASHBOARD-02 · `domain` imports no package

**Level**: Required · **Verified by**: Tool: ESLint `boundaries/dependencies`

Entities (plain types), ports (repository interfaces) and use cases (a class with `execute()`,
depending only on ports): no React, no fetch, no SDK.

### DASHBOARD-03 · `presentation` reaches infrastructure only through `providers/` and `store/`

**Level**: Required · **Verified by**: Tool: ESLint `boundaries/dependencies`

Through `useAppContainer()` and `useRootStore()`, never a repository or an HTTP helper.

### DASHBOARD-04 · Only a presenter calls a use case

**Level**: Required · **Verified by**: Tool: ESLint `no-restricted-imports` on the container

The container appears in a presenter, and in a screen's root component only to build its presenter
(`usePresenter`).

### DASHBOARD-05 · A repository implements a domain port and does its HTTP through `infrastructure/http/`

**Level**: Required · **Verified by**: Review

### DASHBOARD-06 · Wiring is manual, one container per feature

**Level**: Required · **Verified by**: Review

One `*.container.ts` per feature in `infrastructure/providers/`, assembled in `app.container.ts`. No DI
library.

### DASHBOARD-07 · The store holds only state shared across screens

**Level**: Required · **Verified by**: Review

zustand in `infrastructure/store/`; a value in the store is never duplicated as a screen's local
state.

### DASHBOARD-08 · `common` holds cross-cutting code only

**Level**: Required · **Verified by**: Review

Shared components, the error pipeline, generic hooks. What one screen needs belongs to that screen.

### DASHBOARD-09 · Wire shapes and domain entities are one type family

**Level**: Recommended · **Verified by**: Review

The API and the dashboard evolve together: no DTO family mapped onto entities.

## Screens

### DASHBOARD-10 · A screen with state or a use case has five files

**Level**: Required · **Verified by**: Review

In its folder, for every routed screen, each tab of a shell included:

- `<screen>.uido.ts`: the local view state;
- `<screen>.actions.ts`: the discriminated union of what can happen, and its creators;
- `<screen>.reducer.ts`: pure `(state, action) => state`;
- `<screen>.presenter.ts`: receives intents, calls use cases through the container, dispatches the
  result actions;
- `<screen>.component.tsx`: the view; it renders the uido and forwards intents.

**Exceptions**: a screen with no state and no use case is a single `<screen>.component.tsx`; a screen
that shows only state shared in the store has a presenter and a component, since a uido would
duplicate the store; a settings draft (`useSettingsDraft`) is view state the component may hold and
the presenter saves.

### DASHBOARD-11 · A reducer neither fetches nor throws

**Level**: Required · **Verified by**: Review

### DASHBOARD-12 · A screen's sub-parts are dumb components

**Level**: Required · **Verified by**: Review

In `<screen>/components/`, they take state and intent callbacks as props and never reach the
container. A context may carry view state (a filter, an open panel) to avoid threading props, never a
use case.

### DASHBOARD-13 · A panel that several screens open and that calls its own use cases is a screen

**Level**: Required · **Verified by**: Review

The five files in its own folder; the screens that open it render its component.

## Naming

### DASHBOARD-14 · Every file and folder name is snake_case

**Level**: Required · **Verified by**: Tool: ESLint `file-names/snake-case`

The exported identifier keeps its PascalCase or camelCase.

**Exceptions**: the vendored primitives under `common/ui/` keep their generated names.

### DASHBOARD-15 · A file name ends with its role

**Level**: Required · **Verified by**: Review

`hub.presenter.ts`, `camera_list.component.tsx`, `camera.repository.ts`, and in domain
`camera.entity.ts`, `camera.port.ts`, `create_camera.use_case.ts`.

### DASHBOARD-16 · Words follow the layer

**Level**: Recommended · **Verified by**: Review

The user's action in presentation (`onTogglePrivacy`), the business verb in domain (`setPrivacyMode`).

## Errors

### DASHBOARD-17 · Every backend interaction goes through the error pipeline

**Level**: Required · **Verified by**: Review

```
send / fetchJson -> HttpError | NetworkError (infrastructure) -> toAppError (common/errors) -> AppError -> presenter -> view
```

No silent `catch(() => {})`, no ad hoc `try/catch + toast()`.

### DASHBOARD-18 · The diagnostic line is built once, in `infrastructure/http/`

**Level**: Required · **Verified by**: Review

Every error reads at two levels, a sentence and a diagnostic line for support ([SPECS](../SPECS.md)
1.5, [DESIGN SYSTEM](../DESIGN%20SYSTEM.md) § Errors). The line comes from what the answer said;
`toAppError` carries it and scrubs any secret. A screen never builds one and never drops it.

### DASHBOARD-19 · A presenter shows an error either in state or as a toast, never both

**Level**: Required · **Verified by**: Review

It calls the use case in a `try/catch`, converts with `toAppError(e)`, then either dispatches a
`*_FAILED` action shown through the reducer and uido, or calls `toastError(toast, error)` for an
ephemeral notice.

### DASHBOARD-20 · An error renders through the shared components

**Level**: Required · **Verified by**: Review

`<ErrorMessage error={error} />`; a failed read is `<ReadFailure error={error} onRetry={...} />`. A
state that keeps a failure as text keeps `appErrorDiagnostic(error)` beside it and shows it with
`<DiagnosticLine>`.

### DASHBOARD-21 · A special HTTP case still throws an `HttpError`

**Level**: Required · **Verified by**: Review

404 to null, multipart, logic on the status: `send()` in the repository, then
`throw await httpErrorFrom(response, url, method)`; never `new Error()` nor a bare `fetch`.

## Interface foundation

### DASHBOARD-22 · A primitive of `common/ui/` comes from the shadcn registry

**Level**: Required · **Verified by**: Review; its imports by Tool: ESLint `boundaries/dependencies`

Added with `pnpm dlx shadcn@latest add <name>`, never written by hand, never carrying a business
rule, importing only other primitives ([ADR-42](../adr/0042-interface-component-foundation-shadcn-ui-on-radix-and-tailwind.md)).
The Vyzio components built on them live in `common/components/`.

### DASHBOARD-23 · Styles use the design system tokens only

**Level**: Required · **Verified by**: Review

Tailwind v4 with the [DESIGN SYSTEM](../DESIGN%20SYSTEM.md) tokens defined in `src/index.css`: no
literal colour or radius in a component.

### DASHBOARD-24 · A setting is declared, not drawn

**Level**: Required · **Verified by**: Review

[ADR-43](../adr/0043-settings-grammar-a-setting-is-declared-not-drawn.md).

### DASHBOARD-25 · A shared pattern reuses its shared component

**Level**: Required · **Verified by**: Review

The end-of-page `Avancé` fold, a section's long-form help, a card's `Détails techniques`, a detection
list and a detection preview each have one component in `common/`: never a rewritten `<details>`, a
second rendering, or a bare `<img>` that stays broken when surveillance restarts (ADR-40, ADR-53).

### DASHBOARD-26 · A feature's help is written in its screen

**Level**: Required · **Verified by**: Review

Never in a markdown file ([ADR-53](../adr/0053-user-documentation-lives-in-the-interface-three-levels-of-help.md)).
Screens stay light, per the [DESIGN SYSTEM](../DESIGN%20SYSTEM.md) § Intent and § Patterns.

## Tests

### DASHBOARD-27 · Every screen has an integration test through the whole slice

**Level**: Required · **Verified by**: Review

`<screen>.integration.test.tsx`: the real view in a real container, faking only the network
(`renderScreen` and `fakeNetwork` in `src/testing/`), with at least one failure path that asserts
the sentence the user reads.

### DASHBOARD-28 · A unit test goes where a decision lives

**Level**: Recommended · **Verified by**: Review

Reducers, validations, a formatter or mapper with a branch. Declarative code (action creators, uido,
containers) gets none.

### DASHBOARD-29 · Coverage holds 80 % on every metric

**Level**: Required · **Verified by**: Tool: `coverage.thresholds` in `vite.config.ts`

A fixed floor, with no ratchet. The exclude list never widens to meet it (COMMON-07).

### DASHBOARD-30 · E2E tests cover the journeys, against the production build

**Level**: Required · **Verified by**: Review

In `tests/e2e/`, run by `task front:test:e2e` on the production build, faking only the backend.

### DASHBOARD-31 · Every screen is in the accessibility scan

**Level**: Required · **Verified by**: Review

A new screen joins `tests/e2e/accessibility.e2e.ts`, populated with real content.

## Tooling

### DASHBOARD-32 · Nothing unreachable is kept

**Level**: Required · **Verified by**: Tool: `task front:knip`

No file, export or dependency nothing reaches; an export used only in its own file loses its
`export`. Scope: [`CONTRIBUTING.md`](../../CONTRIBUTING.md) § Dead code.

### DASHBOARD-33 · The dashboard type-checks, lints and is formatted

**Level**: Required · **Verified by**: Tool: `task front:typecheck`, `task front:lint`, `task front:format:check`

### DASHBOARD-34 · Packages are managed with pnpm only

**Level**: Required · **Verified by**: Review

`pnpm-lock.yaml` is the one lockfile.
