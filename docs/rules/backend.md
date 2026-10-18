# Backend rules

> Applies when: a file under `src/vyzio/` changes, tests included.

## Layers

### BACKEND-01 · Dependencies point to Core

**Level**: Required · **Verified by**: Tool: `Vyzio.Tests/Architecture/LayeringTests`

Core references only the runtime; Application only Core and the `Microsoft.Extensions.*.Abstractions`
packages; Infrastructure never Application nor Api; Api wires them together.

```
Core           <- domain entities + interfaces (ports). No external dependency.
Application    <- use cases only. Depends on Core. Never a DbContext, never EF.
Infrastructure <- implementations of the Core ports (EF repos, MQTT, HTTP...). Depends on Core.
Api            <- DI wiring + grouped Minimal API endpoints. Depends on Application + Infrastructure.
```

### BACKEND-02 · A use case is a class with `ExecuteAsync`

**Level**: Required · **Verified by**: Review

One class per use case in `Application/UseCases`, receiving the Core ports by injection. No CQRS,
no MediatR.

### BACKEND-03 · Only Infrastructure knows EF, SQLite, MQTT and the transports

**Level**: Required · **Verified by**: Review

A Core port is implemented in Infrastructure; Application and Core see the port only.

### BACKEND-04 · An endpoint never receives the `DbContext`

**Level**: Required · **Verified by**: Review

Endpoints live in `Api/Endpoints/`, grouped per feature, and call use cases. `Program.cs` is wiring
only.

### BACKEND-05 · An error body names its failure and carries no credential

**Level**: Required · **Verified by**: Review

The interface shows an error's `message` or `detail` on screen, for support ([SPECS](../SPECS.md)
1.5): it never carries a credential nor a camera account name. The failure is named by a snake_case
`error` code the interface can branch on.

## Logs

### BACKEND-06 · A log level says who must act, and when

**Level**: Required · **Verified by**: Review

| Level | Who acts | When |
| --- | --- | --- |
| `Trace` | Developer, local debugging | Method entry, with its inputs |
| `Debug` | Developer, investigation | Nominal exit, inputs and outputs |
| `Information` | Owner reading the logs | A milestone: what the service did, readable without the code |
| `Warning` | Owner, if it repeats | A recovered anomaly (retry, skip, reset): what was wrong, what was done |
| `Error` | Owner or developer | An operation failed, the service keeps running |
| `Critical` | Owner, at once | The service can no longer work (startup, a vital dependency lost) |

The table gives the level of a log that is written; it does not require one at every moment. An
entry log sits inside the method it traces, never in its caller; around a component the repository
does not own (an HTTP client, the MQTT client), the caller logs.

### BACKEND-07 · A log is structured

**Level**: Required · **Verified by**: Tool: analyzer CA2254, an error through `TreatWarningsAsErrors`

Values are named parameters of the message template, never interpolated.

### BACKEND-08 · An `Error` or `Critical` log carries the exception

**Level**: Required · **Verified by**: Review

The exception is the first argument.

```csharp
// ✗
_logger.LogError("Could not reach camera {CameraId}", camera.Id);
// ✓
_logger.LogError(ex, "Could not reach camera {CameraId}", camera.Id);
```

### BACKEND-09 · `Warning` means the service carried on

**Level**: Required · **Verified by**: Review

An operation abandoned is an `Error`.

### BACKEND-10 · A caught exception is never swallowed silently

**Level**: Required · **Verified by**: Review

A `catch` logs, rethrows, or translates into a result the caller handles. An empty `catch` or one
that only returns a default hides the failure.

**Exceptions**: a `catch` whose outcome is the expected answer, such as a probe that reads a refused
connection as "unreachable", says so in a one-line comment.

### BACKEND-11 · No secret in a log

**Level**: Required · **Verified by**: Review

No password, token, cookie, camera account, nor an RTSP or HTTP URL with its credentials.

## Tests

### BACKEND-12 · Tests use xUnit, its `Assert`, and NSubstitute

**Level**: Required · **Verified by**: Review

No other assertion or mocking library; a test package is added to `Directory.Packages.props` only by
an owner decision.

### BACKEND-13 · A use case is unit-tested without a database

**Level**: Required · **Verified by**: Review

Its ports are mocked with NSubstitute.

### BACKEND-14 · An integration test runs on SQLite in memory

**Level**: Required · **Verified by**: Review

`EnsureCreated` on an in-memory connection; never a file, never the developer's database.

### BACKEND-15 · Code that waits reads an injected `TimeProvider`

**Level**: Required · **Verified by**: Review

A hosted service, a retry, a timeout or a network probe takes its clock by injection. Its tests drive
`FakeTimeProvider` through `Vyzio.Tests/Services/Hosting/BackgroundLoop` and never sleep. A test
against a real socket keeps the fake clock still, so the verdict comes from what the peer answered,
not from how fast.

## Tooling

### BACKEND-16 · The backend builds without an analyzer warning

**Level**: Required · **Verified by**: Tool: `AnalysisLevel` `latest-recommended` and `TreatWarningsAsErrors` in `Directory.Build.props`

### BACKEND-17 · The backend follows `.editorconfig`

**Level**: Required · **Verified by**: Tool: `task back:format:check`

## Reference: a typical flow

The "Profiles" feature, layer by layer:

```
IProfileRepository        (Core/Interfaces)
ProfileRepository         (Infrastructure/.../Repositories) -> implements IProfileRepository
CreateProfileUseCase      (Application/UseCases/Profiles)   -> receives IProfileRepository by DI
ProfilesEndpoints         (Api/Endpoints)                   -> receives CreateProfileUseCase by DI
CreateProfileUseCaseTests (Tests/UseCases)                  -> mocks IProfileRepository (NSubstitute)
```
