# ADR-01: One .NET API holds the product, SQLite its data, in-process queues its events, and a static React interface sits in front

## Context

Vyzio's own code orchestrates cameras, writes the video pipeline's configuration, notifies, and
keeps profiles and settings. It runs on a small home host, x64 or arm64, installed by someone who
must never operate infrastructure ([SPECS](../SPECS.md) UI-04), and works without internet
([SPECS](../SPECS.md) SYS-03). It needs a typed language with a mature web, database and messaging
ecosystem, maintainable by a small team.

Its components react to the same events (a detection feeds the notification log and the
notifications) and must not call each other directly. Its data is small, relational, and owned by
one product.

The interface is the product for a non-technical public: mobile first, accessible, built without a
dedicated designer, on a local network where bundle size barely matters.

Something outside the process must know whether the API lives: the container healthcheck, which the
interface's container waits on before it starts. Whoever diagnoses an installation needs to know
whether its dependencies answer. Every route sits behind the owner session (ADR-16), and neither
reader holds one.

## Decision

Vyzio's product is one ASP.NET Core process, the API, holding its data in SQLite and passing events
between its services through in-process queues; the interface is a React and TypeScript single-page
application, built statically and served by its own web server container.

- **One process.** Every Vyzio service lives in the API: no second Vyzio process, no internal
  broker. MQTT is only the boundary with Frigate (ADR-02).
- **SQLite through EF Core**, one file in the API's data folder, its schema migrated at startup.
  Frigate keeps its own database, never shared.
- **In-process queues** carry an event from the service that produces it to the ones that consume
  it; a queue is bounded, and a full one refuses and logs rather than delaying without end.
- **The interface** is a static build with no server rendering. Its container is the only service
  published to the user: it serves the files and relays the API and the liveness probe, so no Node
  process runs in production and the API publishes no port.
- **Component foundation**: shadcn/ui primitives copied into the repository, on Radix and Tailwind.
  Their tiers and the tokens are the [DESIGN SYSTEM](../DESIGN%20SYSTEM.md)'s.
- **Two anonymous probes.** Liveness says the process answers, nothing else, and is what the
  container healthcheck reads. Readiness checks the database, the Frigate subscription and Frigate,
  each within a bounded time, Frigate read by the same rule as the engine status (ADR-02). Both
  answer one word per dependency from a closed list, never a message, a version or a host. Only
  liveness is relayed out of the Docker network; readiness is reached from inside it. Any other
  anonymous route needs its own decision.

## Consequences

- ✅ One ecosystem from the domain to the integrations: one process, one log, one dependency
  container, one middleware pipeline.
- ✅ No database to install or run: a backup is a file copy, the footprint stays small.
- ✅ Services stay decoupled: ingestion drops a fact in a queue, its consumers read it, a new
  consumer never reopens ingestion.
- ✅ An expected Frigate restart never marks the API unhealthy, and the interface that explains the
  outage still starts; diagnosis has a probe that needs no session.
- ✅ Accessible primitives (focus, keyboard, roles) without writing them; tests select by role.
- ⚠️ SQLite takes one writer at a time: acceptable because one process writes, and binding: nothing
  else ever writes to this file.
- ⚠️ An event in a queue is lost if the API stops before it is consumed.
- ⚠️ No Vyzio event is offered to a third-party integration.
- ⚠️ Anonymous readiness tells anyone on the Docker network whether a dependency is up; it reveals
  no image, no setting, no secret. Each call costs round trips, so nothing polls it fast.
- ⚠️ The copied primitives are repository code kept up to date by hand; Tailwind is a permanent
  build dependency.

## Options rejected

| Option | Why rejected |
| --- | --- |
| Rust | Performance without need, at the cost of velocity: web, ORM with migrations and messaging must be assembled from lower-level pieces |
| Go | No ORM with managed migrations nor official ONNX bindings at the level .NET offers |
| Python for Vyzio's services | Memory footprint and a second main runtime; Python stays inside Frigate's container |
| FastAPI or NestJS for the API | A second runtime beside the .NET core |
| NativeAOT build | The API runs on the standard runtime image; an ahead-of-time build constrains EF Core and reflection-based libraries for a startup gain the hub does not need |
| A push hub (SignalR) or server-sent events to the interface | The interface reads its few changing states by polling, and the live view has its own relayed socket (ADR-07): no state needs a held push connection |
| PostgreSQL or MariaDB | A container to install and operate, for a concurrency one process does not need |
| An internal message broker between Vyzio's services (MQTT topics, Redis Streams) | One process needs no network hop; Redis adds a container for a persistence and replay nothing requires |
| Internal HTTP callbacks, MediatR, gRPC streaming | More coupling or more infrastructure than a queue in the same process |
| SvelteKit, Vue or Angular | A smaller contributor pool and UI ecosystem than React, for a bundle gain worthless on a local network |
| Server rendering (Next.js) | No SEO on a local network, and a Node process in production |
| The interface served by the API | The API would publish a port: the interface container relaying it keeps readiness and Frigate unreachable from the user's network |
| A home-made component base | Accessibility, focus, keyboard and floating surfaces on mobile all left to write and test |
| Headless primitives without Tailwind | The hard half is solved, the voluminous half (every component's styling) stays, and global CSS grows back |
| Dependencies checked on the liveness probe | Every applied setting restarts Frigate: the API would turn unhealthy on an expected event and hold back the interface's start |
| Readiness behind the owner session | Its readers hold no session, and it is most needed when the interface cannot be reached |
| Only logs for a lost dependency | A log is read after the fact; nothing could ask "is it ready now?" |
