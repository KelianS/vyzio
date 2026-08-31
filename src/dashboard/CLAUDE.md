# React frontend, rules

Loaded when you edit `src/dashboard`. Completes the root router [`../../CLAUDE.md`](../../CLAUDE.md).

## Clean Architecture (mandatory)

Dependency direction, never departed from: `infrastructure -> domain`, `presentation -> domain +
infrastructure`, `common` is a shared base importable from anywhere (never the reverse). Enforced by
the ESLint rule `boundaries/dependencies` (`eslint.config.js`): any violation is a lint error, not a
suggestion.

```
domain/         <- entities (types) + ports (repository interfaces) + usecases. Pure: no React, no fetch.
infrastructure/ <- HttpXxxRepository (fetch + port implementation in the same file), http/
                  (fetchJson, HttpError), config/ (runtime), providers/ (one *.container.ts per screen +
                  app.container.ts + AppContainerContext, manual DI), store/ (zustand, cross-screen state).
presentation/   <- one folder per screen (Hub, Cameras, Profiles, Notifications, DetectionHistory, Expert),
                  five-file pattern `<Screen>.{Uido,Actions,Reducer,Presenter,Component}`.
common/         <- errors/ (AppError + toAppError, the single error pipeline), components/ (shared UI:
                  AppHeader, Toast, Badge, ConfirmModal, PtzControlPanel, LiveFeedModal...),
                  ui/ (**copied** shadcn/ui primitives, see below),
                  presenter/ (usePresenter, generic hook), hooks/ (useAsync, useAsyncAction, polling).
```

## Interface foundation, two tiers ([ADR-42](../../docs/adr/0042-interface-component-foundation-shadcn-ui-on-radix-and-tailwind.md))

- **`common/ui/`** holds shadcn/ui primitives **copied from the registry**, not Vyzio code. They are
  added with `pnpm dlx shadcn@latest add <name>`, never by hand. **Never put a business rule in
  there**: the ESLint `boundaries` rule forbids `ui-primitive` from importing anything but
  `ui-primitive`, and Prettier ignores them so a regeneration produces no noise.
- **`common/components/`** holds Vyzio components built _on top of_ the primitives. That is where the
  product vocabulary and the project's code discipline live.
- **Styles**: Tailwind v4 only. The [DESIGN SYSTEM](../../docs/DESIGN%20SYSTEM.md) tokens are realised
  in `src/index.css` (light and dark themes); **no literal colour or radius in a component**, always a
  token.
- **`App.css` is gone**: no colour, no global rule; every screen is Tailwind plus tokens.
- A setting **is declared, it is not drawn**:
  [ADR-43](../../docs/adr/0043-settings-grammar-a-setting-is-declared-not-drawn.md)
  fixes the control table and the anatomy of a settings row.
- The end-of-page `Avance` fold is the `common/settings/AdvancedFold` component, never a rewritten
  `<details>` nor a section that folds nothing away (it is a position, not a mode, ADR-40).
- A section's long-form help is `common/components/HelpPanel`, likewise never a rewritten
  `<details>`; its heading is the question being asked, not the name of a chapter (ADR-53).
- A detection list is `common/detection/DetectionList`, on the home screen as in the history (the
  home screen shows only the latest ones). Two separate renderings had drifted apart.
- A detection preview goes through `common/components/DetectionThumbnail`, never a bare `<img>`,
  which leaves a broken image when surveillance restarts and never retries.

- **domain** depends on nothing (no framework, no HTTP). A port is an interface (`CameraRepository`).
  A use case is a class with `execute()`, depending only on domain ports.
- **infrastructure**: the `HttpXxxRepository` classes implement the `domain/ports` interfaces and do
  the fetching themselves (no separate gateway layer). Every fetch goes through
  `infrastructure/http/fetchJson.ts`.
- **presentation**: five files per screen, `<Screen>.Uido.ts` (local view state),
  `<Screen>.Actions.ts` (discriminated union + creators), `<Screen>.Reducer.ts` (pure, no fetch),
  `<Screen>.Presenter.ts` (orchestration through the container, action dispatch),
  `<Screen>.Component.tsx` (dumb view, never fetches directly). A component **never** calls `fetch`
  or a repository directly, always a use case, through the screen's presenter.
  Exception: a screen with no state and no domain call (`Expert`, for instance) stays a single file.
  The already-autonomous subsections of a screen (`PrivacyScheduleSection`, `PtzCalibrationSection`,
  `CapabilitySection` under `Cameras/`) keep their own local state through `useAppContainer()` rather
  than lifting everything into the parent reducer.
- Wiring (instantiating repos and use cases) lives **only** in `infrastructure/providers/` (one
  `*.container.ts` per screen, assembled in `app.container.ts`, exposed through `AppContainerContext`
  and `useAppContainer()`).
- **Navigation**: `react-router` (`BrowserRouter`/`Routes`, lazy per screen in `App.tsx`).
- **State shared across screens** (`cameras`, `systemStats`): zustand
  (`infrastructure/store/rootStore.ts`), never duplicated as per-screen local state.

## Error handling (mandatory)

Every backend interaction goes through the pipeline. No silent `catch(() => {})`, no ad hoc
`try/catch + toast()`.

```
fetch -> HttpError (infrastructure) -> toAppError (common/errors) -> AppError -> presenter / useAsync / useAsyncAction (UI)
```

- **A simple screen, outside the five-file pattern** (an autonomous subsection such as
  `CapabilitySection`): `useAsync(() => useCase.execute(), [deps])` giving
  `{ data, loading, error, reload }` for reads, and `useAsyncAction(fn, { onSuccess })` giving an
  automatic error toast, no catch, for mutations. Both live in `common/hooks/`.
- **A five-file screen**: the presenter calls the use case inside a `try/catch`, converts with
  `toAppError(e)`, and either dispatches a `*_FAILED` action (error shown through the reducer and
  uido) or calls `toast(appErrorMessage(error), 'error')` for an ephemeral notification, never both
  for the same error.
- **Showing an error in the render**: `appErrorMessage(error)` (`common/errors/AppError.ts`).
- **Testing the kind of an error**: `AppErrorKind` (never string literals).
- **Special cases** (404 to null, multipart, logic on the status): a manual fetch in the repository,
  but throwing `HttpError`, never `new Error()`.

Forbidden: throwing a bare `Error` carrying an HTTP status, `.catch(() => {})` in a component, local
HTTP helpers in the repositories (everything goes through `infrastructure/http/fetchJson.ts`).

## Type-safe comparisons (golden rule)

Never compare a business value against a string literal scattered through the JSX or the logic
(`if (x !== 'active')`). The literal union type (`type Status = 'active' | 'restarting' | ...`) is
already the idiomatic TypeScript pattern; on top of it, use an exhaustive `switch` (with a
`default: { const _x: never = ...; }` branch) or a `Record<Union, T>` table, never a chain of
repeated `===` / `!==` comparisons.

## UI

Buttons, status pills, confirmation modals, styles, radius tokens: follow the
[`../../docs/DESIGN SYSTEM.md`](../../docs/DESIGN%20SYSTEM.md) guide.

A feature's help is written **here**, in the screen, never in a markdown file alongside: visible text,
a setting's tooltip, or a section's `En savoir plus` panel, a tooltip fitting in two sentences
([ADR-53](../../docs/adr/0053-user-documentation-lives-in-the-interface-three-levels-of-help.md)).

## Tooling

- **pnpm** mandatory (never npm or yarn).
- Tests through Vitest (`task front:test`).
- **Dead code**: `task front:knip` fails CI on any file, export or dependency nothing reaches. An
  export used only inside its own file loses its `export`, it does not become an exception. Scope and
  exclusions: [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) § Dead code.
