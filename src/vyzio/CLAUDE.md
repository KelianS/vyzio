# .NET backend, rules

Loaded when you edit `src/vyzio`. Completes the root router [`../../CLAUDE.md`](../../CLAUDE.md).

## Clean Architecture (mandatory)

Dependency direction, never departed from:

```
Core          <- domain entities + interfaces (ports). No external dependency.
Application   <- use cases only. Depends on Core. Never a DbContext, never EF.
Infrastructure<- implementations of the Core ports (EF repos, MQTT, HTTP...). Depends on Core.
Api           <- DI wiring + grouped Minimal API endpoints. Depends on Application + Infrastructure.
```

- **Core**: POCOs and interfaces only. No EF, no ASP.NET, no infrastructure package.
- **Application**: a use case is a class with `ExecuteAsync`. No CQRS, no MediatR. No direct EF access.
- **Infrastructure**: the only layer allowed to know about EF, SQLite, MQTT and the like.
- **Api**: endpoints live in `Endpoints/`, `Program.cs` is wiring only. The `DbContext` is **never** injected into an endpoint.

A typical flow (the "Profiles" feature):

```
IProfileRepository        (Core/Interfaces)
ProfileRepository         (Infrastructure/.../Repositories) -> implements IProfileRepository
CreateProfileUseCase      (Application/UseCases/Profiles)   -> receives IProfileRepository by DI
ProfilesEndpoints         (Api/Endpoints)                   -> receives CreateProfileUseCase by DI
CreateProfileUseCaseTests (Tests/UseCases)                  -> mocks IProfileRepository (NSubstitute)
```

## Type-safe comparisons (golden rule)

Never compare a business value against a string literal (`if (x == "active")`). Use an `enum`
(`Vyzio.Core.Entities`) and compare or switch on it. At the API boundary (JSON DTOs), convert through
`SnakeCaseEnum.ToSnakeCase` / `TryFromSnakeCase` (`Vyzio.Core.Common`), never a hardcoded string on
either side.

## Tests

- Unit: use cases mocked with **NSubstitute**, no database.
- Integration: **SQLite in-memory** (`EnsureCreated`).
- A use case must stay testable without a database.
