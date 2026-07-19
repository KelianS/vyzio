# Backend .NET — règles

Chargé quand tu édites `src/vyzio`. Complète le routeur racine [`../../CLAUDE.md`](../../CLAUDE.md).

## Clean Architecture (obligatoire)

Direction des dépendances, jamais dérogée :

```
Core          ← entités domaine + interfaces (ports). Aucune dépendance externe.
Application   ← use cases uniquement. Dépend de Core. Jamais de DbContext ni d'EF.
Infrastructure← implémentations des ports Core (repos EF, MQTT, HTTP…). Dépend de Core.
Api           ← wiring DI + endpoints Minimal API groupés. Dépend de Application + Infrastructure.
```

- **Core** : POCO + interfaces uniquement. Pas d'EF, pas d'ASP.NET, pas de package infra.
- **Application** : un use case = une classe avec `ExecuteAsync`. Pas de CQRS/MediatR. Pas d'accès EF direct.
- **Infrastructure** : seule couche autorisée à connaître EF, SQLite, MQTT…
- **Api** : endpoints dans `Endpoints/`, `Program.cs` = wiring seul. Le `DbContext` n'est **jamais** injecté dans un endpoint.

Flux type (feature « Profiles ») :

```
IProfileRepository        (Core/Interfaces)
ProfileRepository         (Infrastructure/…/Repositories) → implémente IProfileRepository
CreateProfileUseCase      (Application/UseCases/Profiles) → reçoit IProfileRepository par DI
ProfilesEndpoints         (Api/Endpoints)                 → reçoit CreateProfileUseCase par DI
CreateProfileUseCaseTests (Tests/UseCases)                → mock IProfileRepository (NSubstitute)
```

## Comparaisons type-safe (règle d'or)

Ne jamais comparer une valeur métier à une chaîne littérale (`if (x == "active")`). Utiliser un
`enum` (`Vyzio.Core.Entities`) et comparer/switcher dessus. À la frontière API (DTO JSON), convertir
via `SnakeCaseEnum.ToSnakeCase` / `TryFromSnakeCase` (`Vyzio.Core.Common`) — jamais une string en dur
des deux côtés.

## Tests

- Unitaires : use cases mockés via **NSubstitute**, zéro DB.
- Intégration : **SQLite in-memory** (`EnsureCreated`).
- Un use case doit rester testable sans base de données.
