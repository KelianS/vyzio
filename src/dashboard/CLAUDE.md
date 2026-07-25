# Frontend React — règles

Chargé quand tu édites `src/dashboard`. Complète le routeur racine [`../../CLAUDE.md`](../../CLAUDE.md).

## Clean Architecture (obligatoire)

Même hexagone que le backend, direction des dépendances jamais dérogée :

```
domain/         ← entités (types) + ports (interfaces repository) + errors. Pur : aucun React, aucun fetch.
application/    ← use cases : une classe avec execute(), reçoit ses ports par le constructeur.
infrastructure/ ← adapters : implémentations des ports (HttpXxxRepository), http/ (fetchJson, HttpError), config/.
ui/             ← components React, hooks (useAsync/useAsyncAction), formatters. Consomme les use cases.
app/            ← dependencies.ts : composition root (instancie repositories + use cases, DI manuel).
```

- **domain** ne dépend de rien (ni framework, ni HTTP). Un port = une interface (`CameraRepository`).
- **application** : un use case = une classe avec `execute()`, dépend uniquement des ports `domain/`. Ne connaît pas HTTP.
- **infrastructure** : les `HttpXxxRepository` implémentent les ports `domain/ports`. Tout fetch passe par `infrastructure/http/fetchJson.ts`.
- **ui** : un composant n'appelle **jamais** `fetch` ni un repository directement — il passe par un use case (via `dependencies.ts` + `useAsync` / `useAsyncAction`).
- Le wiring (instanciation repos + use cases) vit **uniquement** dans `app/dependencies.ts`.

## Gestion des erreurs (obligatoire)

Toute interaction backend passe par la pipeline. Jamais de `catch(() => {})` silencieux ni de
`try/catch + toast()` ad hoc.

```
fetch → HttpError (infrastructure) → toAppError (domaine) → AppError → useAsync / useAsyncAction (UI)
```

- **Lecture de données** → `useAsync(() => useCase.execute(), [deps])` → `{ data, loading, error, reload }`.
- **Mutation / action utilisateur** → `useAsyncAction(fn, { onSuccess })` → toast d'erreur automatique, pas de catch.
- **Afficher une erreur dans le rendu** → `appErrorMessage(error)`.
- **Tester le type d'une erreur** → `AppErrorKind` (jamais les string literals).
- **Cas spéciaux** (404 → null, multipart, logique sur le status) → fetch manuel dans le repository, mais lancer `HttpError`, jamais `new Error()`.

Interdits : `throw new Error(\`HTTP ${status}\`)`, `.catch(() => {})`dans un composant, helpers HTTP
locaux dans les repositories (tout passe par`infrastructure/http/fetchJson.ts`).

## Comparaisons type-safe (règle d'or)

Ne jamais comparer une valeur métier à une chaîne littérale éparpillée dans le JSX/logique
(`if (x !== 'active')`). Le type union littéral (`type Status = 'active' | 'restarting' | ...`) est
déjà le pattern idiomatique côté TS ; dessus, utiliser un `switch` exhaustif (avec branche
`default: { const _x: never = ...; }`) ou une table `Record<Union, T>` — jamais une chaîne de
comparaisons `===`/`!==` répétées.

## UI

Boutons, pastilles d'état, modales de validation, styles, tokens de rayon → suivre le guide
[`../../docs/DESIGN SYSTEM.md`](../../docs/DESIGN%20SYSTEM.md).

## Outillage

- **pnpm** obligatoire (jamais npm/yarn).
- Tests via Vitest (`task front:test`).
