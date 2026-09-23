# ADR-55 — Health split into liveness and readiness, both anonymous, only liveness relayed

> Status: Accepted

## Context

`/health` answered `ok` whatever happened behind it. A locked database, a lost MQTT subscription or a
Frigate that no longer answers all left it green, so nothing outside the process could tell a working
Vyzio from one that only looks alive.

Two readers depend on that route today, and they need opposite things:

- the API container's `HEALTHCHECK` ([Dockerfile](../../src/vyzio/Vyzio.Api/Dockerfile)) reads it, and
  the dashboard container waits for `service_healthy` before it starts
  ([docker-compose](../../docker-compose.yml)). This reader needs to know **the process answers**;
- whoever diagnoses an installation (an operator, a support session, a future update flow) needs to
  know **whether the dependencies answer**.

[ADR-54](0054-interface-access-guarded-by-an-owner-account-server-session-in-a-cookie.md) puts every
route behind the owner session, with two named exceptions: the container health probe, and the account
creation routes. Adding a second probe outside the barrier is a third exception, which is why this
needs a decision and not just a route.

## Options

1. **Check the dependencies on `/health`.** Rejected: the container healthcheck would then fail every
   time Frigate restarts, which it does on every applied settings change
   ([ADR-44](0044-surveillance-restart-an-explicit-user-act-grouped-and-deferred.md)). The API would be
   marked unhealthy for an expected event, and a Frigate down after startup would hold back the next
   start of the dashboard, which waits on that healthcheck: the one screen that explains the outage
   would be the one missing.
2. **Put readiness behind the owner session.** Rejected: the probe is read by tools and people who
   hold no browser session, and it is most needed exactly when the interface cannot be reached. What
   it returns does not need a barrier either (see the decision).
3. **Keep `/health` as it was and let each dependency's owner log its loss.** Rejected: the logs
   already say it, but a log is read after the fact; nothing can ask "is it ready now?".
4. **Two probes: `/health` for liveness, `/health/ready` for readiness, both anonymous, only liveness
   relayed by the dashboard.** Retained.

## Decision

**Option 4.**

- **Liveness** (`/health`) says the process answers, and nothing else. It is what the container
  healthcheck reads, so an expected Frigate restart never marks the API unhealthy.
- **Readiness** (`/health/ready`) checks the database, the MQTT subscription and Frigate, each within a
  bounded time, and answers `503` when one of them is down. Frigate reads on three levels, with the same
  rule as the hub ([ADR-33](0033-detection-engine-status-exposed-on-the-hub.md)): a restart Vyzio asked
  for is *degraded*, silence otherwise is *down*.
- **Both are anonymous and say nothing but one word per dependency, from a closed list**: `ok`,
  `starting` (the first attempt since startup has not concluded), `restarting` (a restart Vyzio asked
  for), `unavailable`. No version, no host, no error message, no exception: the framework puts the
  exception message in a check's description, so a description outside the list is never written.
  What an anonymous caller learns is whether a dependency is up, coming up or down, which reveals no
  image, no setting and no secret. The overall status and the HTTP code stay the framework's own.
- **Only liveness leaves the Docker network** of the production stack. The dashboard relays `/health`
  exactly and nothing under it ([nginx.conf](../../src/dashboard/nginx.conf)), and the API publishes no
  port there, so `/health/ready` is reached from inside that network only (a `docker exec` on the host,
  for instance). The development stack publishes the API and is not bound by this.
- Both answer `GET` only.

This widens ADR-54's list of routes outside the barrier to **three**: liveness, readiness, and the
account creation routes. The list stays closed: a new anonymous route needs its own ADR.

## Consequences

- **The hub and the probe share Frigate's rule, not its state.** The three-level reading lives in one
  place, [`FrigateStatusReader`](../../src/vyzio/Vyzio.Application/UseCases/Monitoring/FrigateStatusReader.cs),
  which ADR-33 described inside the stats use case. Each call asks Frigate afresh, and a readiness
  call that finds Frigate up closes a restart window just as a hub refresh does.
- **A probe call costs two round trips** (database, Frigate) and a read of the subscription state kept
  by the MQTT ingress. Acceptable for a route that nothing polls at a high rate; if something ever
  does, readiness gets a cache, not a slimmer check.
- **Readiness logs nothing.** The owners of each dependency already log its loss; the probe would repeat
  it on every call, so the health-check log category is silenced below `Critical`.
- **Nothing reads readiness automatically yet.** It exists for diagnosis first; wiring it into an
  orchestrator or an update flow is a later decision, which this probe makes possible without
  another anonymous route.
