# Frontend React — règles

Chargé quand tu édites `src/dashboard`. Complète le routeur racine [`../../CLAUDE.md`](../../CLAUDE.md).

## Clean Architecture (obligatoire)

Direction des dépendances jamais dérogée : `infrastructure → domain`, `presentation → domain +
infrastructure`, `common` est un socle partagé importable de partout (jamais l'inverse). Appliquée
via la règle ESLint `boundaries/dependencies` (`eslint.config.js`) — toute violation est une erreur
de lint, pas une suggestion.

```
domain/         ← entities (types) + ports (interfaces repository) + usecases. Pur : aucun React, aucun fetch.
infrastructure/ ← HttpXxxRepository (fetch + implémentation du port dans le même fichier), http/
                  (fetchJson, HttpError), config/ (runtime), providers/ (un *.container.ts par écran +
                  app.container.ts + AppContainerContext, DI manuel), store/ (zustand, état cross-écrans).
presentation/   ← un dossier par écran (Hub, Cameras, Profiles, Notifications, DetectionHistory, Expert),
                  pattern 5 fichiers `<Screen>.{Uido,Actions,Reducer,Presenter,Component}`.
common/         ← errors/ (AppError + toAppError, unique pipeline d'erreurs), components/ (UI partagée :
                  AppHeader, Toast, Badge, ConfirmModal, PtzControlPanel, LiveFeedModal…),
                  ui/ (primitives shadcn/ui **copiées**, voir ci-dessous),
                  presenter/ (usePresenter, hook générique), hooks/ (useAsync, useAsyncAction, polling).
```

## Socle d'interface — deux étages ([ADR-42](../../docs/adr/0042-interface-component-foundation-shadcn-ui-on-radix-and-tailwind.md))

- **`common/ui/`** = primitives shadcn/ui **copiées du registre**, pas du code Vyzio. On les ajoute
  avec `pnpm dlx shadcn@latest add <nom>`, jamais à la main. **Ne jamais y mettre de règle métier** :
  la règle ESLint `boundaries` interdit à `ui-primitive` d'importer autre chose que `ui-primitive`,
  et Prettier les ignore pour qu'une régénération ne produise aucun bruit.
- **`common/components/`** = composants Vyzio bâtis _au-dessus_ des primitives. C'est là que vivent
  le vocabulaire produit et la discipline de code du projet.
- **Styles** : Tailwind v4 uniquement. Les tokens du
  [DESIGN SYSTEM](../../docs/DESIGN%20SYSTEM.md) sont réalisés dans `src/index.css` (thème clair et
  sombre) ; **aucune couleur ni rayon littéral dans un composant**, toujours un token.
- **`App.css` est supprimé** : aucune couleur ni règle globale ; tout écran est en Tailwind + tokens.
- Un réglage **se déclare, il ne se dessine pas** :
  [ADR-43](../../docs/adr/0043-settings-grammar-a-setting-is-declared-not-drawn.md)
  fixe la table des contrôles et l'anatomie de la ligne de réglage.
- Le repli de fin de page `Avancé` est le composant `common/settings/AdvancedFold` — jamais un
  `<details>` réécrit ni une section qui ne replie rien (c'est une position, pas un mode, ADR-40).
- L'aide longue d'une section est `common/components/HelpPanel` — également jamais un `<details>`
  réécrit ; son titre est la question posée, pas le nom d'un chapitre (ADR-53).
- Une liste de détections est `common/detection/DetectionList`, à l'accueil comme dans l'historique
  (l'accueil n'en est que les dernières) — deux rendus séparés avaient divergé.
- Un aperçu de détection passe par `common/components/DetectionThumbnail` : jamais un `<img>` nu,
  qui laisse une image cassée quand la surveillance redémarre et ne retente jamais.

- **domain** ne dépend de rien (ni framework, ni HTTP). Un port = une interface (`CameraRepository`).
  Un use case = une classe avec `execute()`, dépend uniquement des ports du domaine.
- **infrastructure** : les `HttpXxxRepository` implémentent les ports `domain/ports` et font le fetch
  eux-mêmes (pas de couche gateway séparée) — tout fetch passe par `infrastructure/http/fetchJson.ts`.
- **presentation** : pattern 5 fichiers par écran — `<Screen>.Uido.ts` (état de vue local),
  `<Screen>.Actions.ts` (union discriminée + créateurs), `<Screen>.Reducer.ts` (pur, aucun fetch),
  `<Screen>.Presenter.ts` (orchestration via le container, dispatch des actions), `<Screen>.Component.tsx`
  (vue "dumb", ne fetch jamais directement). Un composant n'appelle **jamais** `fetch` ni un repository
  directement — toujours via un use case, à travers le presenter de l'écran.
  Exception : un écran sans état ni appel domaine (ex. `Expert`) reste un fichier unique.
  Les sous-sections déjà autonomes d'un écran (ex. `PrivacyScheduleSection`, `PtzCalibrationSection`,
  `CapabilitySection` sous `Cameras/`) gardent leur propre état local via `useAppContainer()` plutôt
  que de tout remonter dans le reducer parent.
- Le wiring (instanciation repos + use cases) vit **uniquement** dans `infrastructure/providers/`
  (un `*.container.ts` par écran, assemblés dans `app.container.ts`, exposés via
  `AppContainerContext` / `useAppContainer()`).
- **Navigation** : `react-router` (`BrowserRouter`/`Routes`, lazy par écran dans `App.tsx`).
- **État partagé entre écrans** (`cameras`, `systemStats`) : zustand (`infrastructure/store/rootStore.ts`),
  jamais dupliqué en état local par écran.

## Gestion des erreurs (obligatoire)

Toute interaction backend passe par la pipeline. Jamais de `catch(() => {})` silencieux ni de
`try/catch + toast()` ad hoc.

```
fetch → HttpError (infrastructure) → toAppError (common/errors) → AppError → presenter / useAsync / useAsyncAction (UI)
```

- **Écran simple, hors du pattern 5-fichiers** (sous-section autonome type `CapabilitySection`) →
  `useAsync(() => useCase.execute(), [deps])` → `{ data, loading, error, reload }` pour la lecture,
  `useAsyncAction(fn, { onSuccess })` → toast d'erreur automatique, pas de catch, pour les mutations.
  Les deux vivent dans `common/hooks/`.
- **Écran 5-fichiers** → le presenter appelle le use case dans un `try/catch`, convertit avec
  `toAppError(e)`, et soit dispatch une action `*_FAILED` (erreur affichée dans le reducer/uido), soit
  appelle `toast(appErrorMessage(error), 'error')` pour une notification éphémère — jamais les deux à
  la fois pour la même erreur.
- **Afficher une erreur dans le rendu** → `appErrorMessage(error)` (`common/errors/AppError.ts`).
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

L'aide d'une feature s'écrit **ici**, dans l'écran, jamais dans un markdown à côté : visible / infobulle
d'un réglage / panneau `En savoir plus` d'une section, une infobulle tenant en deux phrases
([ADR-53](../../docs/adr/0053-user-documentation-lives-in-the-interface-three-levels-of-help.md)).

## Outillage

- **pnpm** obligatoire (jamais npm/yarn).
- Tests via Vitest (`task front:test`).
- **Code mort** : `task front:knip` bloque la CI sur tout fichier, export ou dépendance que rien
  n'atteint. Un export utilisé seulement dans son propre fichier perd son `export`, il ne devient
  pas une exception. Portée et exclusions : [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md)
  § Dead code.
