# React frontend, rules

Loaded when you edit `src/dashboard`. Completes the root router [`../../CLAUDE.md`](../../CLAUDE.md).
These are conventions: they hold for any screen, present or future, and name no screen in particular.
Code written before a convention may not follow it yet: never take it as a model. The lint names what
is left to bring in line.

## Layers (mandatory, enforced by lint)

Dependencies point inward: `infrastructure -> domain <- presentation`. `common` is a shared kernel
importable from anywhere, and may read `domain` types. The `boundaries/dependencies` rule of
`eslint.config.js` enforces it; a lint error there means a wire crossed a layer, fixed by routing it
through a port or the container, never by silencing the rule.

- **domain**: entities (plain types), ports (repository interfaces), use cases (a class with
  `execute()`, depending only on ports). It imports no npm package: no React, no fetch, no SDK.
- **infrastructure**: repositories implementing the domain ports, which do the HTTP themselves through
  `infrastructure/http/`; `providers/` (the composition root: one `*.container.ts` per feature,
  assembled in `app.container.ts`, manual wiring, no DI library); `store/` (zustand, only for state
  shared across screens, never duplicated as a screen's local state).
- **presentation** reaches infrastructure only through `providers/` (`useAppContainer()`) and `store/`
  (`useRootStore()`), never a repository or an HTTP helper.
- **common**: cross-cutting code only (shared components, the error pipeline, generic hooks). What only
  one screen needs belongs to that screen.
- Wire shapes and domain entities are not split into separate type families: the API and the
  dashboard evolve together.

## The screen pattern (mandatory)

**The presenter is the only place that calls a use case.** The lint rejects the container and the
use-case hooks anywhere else in `presentation/` and `common/`, apart from a list of files still to
migrate that only shrinks.

- Every routed screen, each tab of a shell included, has five files in its folder:
  - `<screen>.uido.ts`: the local view state;
  - `<screen>.actions.ts`: the discriminated union of what can happen, and its creators;
  - `<screen>.reducer.ts`: pure `(state, action) => state`, no fetch, no throw;
  - `<screen>.presenter.ts`: receives intents, calls use cases through the container, dispatches the
    result actions;
  - `<screen>.component.tsx`: the view. It renders the uido, forwards intents, and uses the container
    only to build its presenter (`usePresenter`).
- A screen with no state and no use case is a single `<screen>.component.tsx`.
- A screen's sub-parts live in `<screen>/components/` as dumb components: they take state and intent
  callbacks as props, and never reach the container. A context may carry view state (a filter, an
  open panel) to avoid threading props, never a use case.
- A settings draft (`useSettingsDraft`) is view state: the component may hold it, the presenter saves
  it.

## Naming

- **Every file name is snake_case**, suffixed by its role: `hub.presenter.ts`,
  `camera_list.component.tsx`, `camera.repository.ts`. The exported React component keeps its
  PascalCase identifier. Vendored primitives under `common/ui/` keep their generated names.
- Words follow the layer: the user's action in presentation (`onTogglePrivacy`), the business verb in
  domain (`setPrivacyMode`).

## Tests

- Names follow the test name convention of the root [`CLAUDE.md`](../../CLAUDE.md).
- Unit and integration tests read in **AAA**, with the comments written: `// Arrange`, `// Act`,
  `// Assert`, merged as `// Arrange & Act` when the setup is the action. E2E tests read top to bottom
  instead.
- **Every screen has `<screen>.integration.test.tsx`**: the real view in a real container, faking only
  the network, including one failure path that asserts the sentence the user reads.
- Unit tests go where a decision lives: reducers, validations, a formatter or mapper with a branch.
  Declarative code (action creators, uido, containers) gets none.
- No logic in a test (no loop, no condition, no computed expectation): `it.each` for one assertion over
  several inputs.
- The coverage floor (`thresholds` in `vite.config.ts`) only rises: a PR may raise it, never lower it,
  and never widens the exclude list to meet it.
- E2E tests live in `tests/e2e/`, run against the production build, and cover the journeys a user
  walks through.

## Interface foundation ([ADR-42](../../docs/adr/0042-interface-component-foundation-shadcn-ui-on-radix-and-tailwind.md))

- **`common/ui/`** holds shadcn/ui primitives **copied from the registry**, added with
  `pnpm dlx shadcn@latest add <name>`, never by hand, and never carrying a business rule. The lint lets
  them import only each other.
- **`common/components/`** holds the Vyzio components built on top of them.
- **Styles**: Tailwind v4 only, with the [DESIGN SYSTEM](../../docs/DESIGN%20SYSTEM.md) tokens defined
  in `src/index.css`. No literal colour or radius in a component.
- A setting **is declared, it is not drawn** ([ADR-43](../../docs/adr/0043-settings-grammar-a-setting-is-declared-not-drawn.md)).
- The end-of-page `Avancé` fold, a section's long-form help, a detection list and a detection preview
  each have one shared component in `common/`. Reuse it: never a rewritten `<details>`, a second
  rendering, or a bare `<img>` that stays broken when surveillance restarts (ADR-40, ADR-53).
- A feature's help is written in the screen, never in a markdown file
  ([ADR-53](../../docs/adr/0053-user-documentation-lives-in-the-interface-three-levels-of-help.md)).
- Keep screens light, per the [DESIGN SYSTEM](../../docs/DESIGN%20SYSTEM.md) § Intent and § Settings
  screens.

## Error handling (mandatory)

Every backend interaction goes through one pipeline. No silent `catch(() => {})`, no ad hoc
`try/catch + toast()`.

```
send / fetchJson -> HttpError | NetworkError (infrastructure) -> toAppError (common/errors) -> AppError -> presenter -> view
```

- Every error reads at two levels, a sentence and a diagnostic line for support ([SPECS](../../docs/SPECS.md)
  1.5, [DESIGN SYSTEM](../../docs/DESIGN%20SYSTEM.md) § Errors). The line is built once, in
  `infrastructure/http/`, from what the answer said. `toAppError` carries it and scrubs any secret. A
  screen never builds one and never drops it.
- The presenter calls the use case in a `try/catch` and converts with `toAppError(e)`. It then either
  dispatches a `*_FAILED` action, shown through the reducer and uido, or calls
  `toastError(toast, error)` for an ephemeral notice. Never both for the same error.
- In the render, an error is `<ErrorMessage error={error} />`, and a failed read is
  `<ReadFailure error={error} onRetry={...} />`. A state that keeps a failure as text keeps
  `appErrorDiagnostic(error)` beside it and shows it with `<DiagnosticLine>`.
- The kind of an error is tested through `AppErrorKind`, never a string literal.
- Special cases (404 to null, multipart, logic on the status) use `send()` in the repository, then
  `throw await httpErrorFrom(response, url, method)`, never `new Error()` or a bare `fetch`.

## Type-safe comparisons (golden rule)

Never compare a business value against a string literal (`if (x !== 'active')`). On a literal union,
use an exhaustive `switch` (with a `default: { const _x: never = ... }` branch) or a
`Record<Union, T>` table.

## Tooling

- **pnpm** only.
- Tests through Vitest (`task front:test`), e2e through Playwright (`task front:test:e2e`).
- **Dead code**: `task front:knip` fails CI on any file, export or dependency nothing reaches. An export
  used only in its own file loses its `export`. Scope and exclusions:
  [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) § Dead code.
