# ADR-02: Frigate is the video pipeline, embedded unmodified, driven by a generated configuration and reached only by the API

## Context

Ingesting camera streams, decoding them, detecting motion, objects and faces, and recording is a
hard problem already solved well. Rebuilding it would cost months for a worse result, and it is not
what Vyzio adds: Vyzio's value is the product around it, for a non-technical public.

That public never writes a configuration file ([SPECS](../SPECS.md) UI-04), never sees nor names
the engine (product principle 2; [SPECS](../SPECS.md) SYS-01, UI-02), and must be able to trust
that no image leaves the hub or reaches anyone unauthenticated ([SPECS](../SPECS.md) SEC-01).

Frigate covers the pipeline with hardware acceleration and a permissive licence. It publishes its
events over MQTT, offers a REST API for events, media, faces and statistics, reads one
configuration file, and applies a changed file by restarting. It also ships its own web interface,
built for NVR experts, and its API carries no authentication of its own.

## Decision

Frigate, embedded unmodified in its own container at a pinned version, runs the video pipeline;
Vyzio writes its whole configuration, hears its events over MQTT, reads and drives it over its REST
API, and is the only thing that reaches it.

- **Public interfaces only**: MQTT, REST, the configuration file in a folder shared with the API,
  its go2rtc for the live view (ADR-07) and its model cache (ADR-03, ADR-08). Its code is never
  modified.
- **Vyzio's database is the source of truth; the configuration is derived from it.** It is rebuilt
  whole at every change, never patched, and written atomically, so Frigate never reads a half file.
  Writing and applying are two steps: a written change waits, marked pending beside the file, until
  a restart applies it (ADR-15). The API restarts Frigate through the host's container engine, with
  a command fixed at startup. A runtime tuning that needs no restart goes over MQTT (ADR-08).
- **MQTT** runs on a dedicated broker on the internal Docker network: anonymous, without
  persistence, published nowhere. Vyzio subscribes to Frigate's event topic only, at least once,
  and reads a bounded contract: a few required fields (the event's identity, camera, label, start,
  lifecycle), a few optional ones, any other field ignored. The raw payload is never stored. Vyzio
  publishes commands to Frigate, never a topic of its own.
- **REST** completes what MQTT carries: an event's details and media, the face library, the
  statistics, the erasing of a detection (ADR-12, ADR-13).
- **Coupling stays at the edge.** Only infrastructure adapters speak Frigate; the rest of Vyzio
  sees its own domain facts, carried by in-process queues (ADR-01).
- **Never exposed.** Frigate publishes nothing to the user's network and the browser never learns
  it exists. The API, behind the owner session (ADR-16), is the single entry: it relays the live
  view (ADR-07) and the media (ADR-12). No screen of the interface embeds or links Frigate's own.
- **The engine status** is read from Frigate's own answer, crossed with a restart Vyzio asked for
  within a bounded window, never from the container's state. One reading serves the interface and
  the readiness probe (ADR-01).

## Consequences

- ✅ A production-ready pipeline and hardware support from day one, improved by each Frigate release.
- ✅ The interface never depends on Frigate's syntax or concepts; replacing the engine touches the
  adapters, not the domain.
- ✅ One authenticated entry point, one place to audit what reaches the browser.
- ✅ A restart that finishes resolves the status by itself; a restart that fails shows as down
  instead of hanging on "restarting".
- ⚠️ A third-party dependency, in Python, isolated in its container; its MQTT and REST formats move
  between versions, so each upgrade is read again against this contract and ADR-03.
- ⚠️ The API holds the host's container engine socket to restart Frigate: a broad power on the host.
- ⚠️ Camera credentials are copied in the clear into the generated configuration: Frigate needs them
  to open the streams.
- ⚠️ Applying restarts the whole engine and pauses surveillance on every camera (ADR-15 makes it an
  explicit act).
- ⚠️ At-least-once delivery: an event may arrive twice, and acting on it must stay idempotent. An
  event in flight is lost if the broker restarts.
- ⚠️ The contract is tested against doubles, without a real broker.

## Options rejected

| Option | Why rejected |
| --- | --- |
| Shinobi | Basic person detection, a limited API |
| ZoneMinder | Weak detection, a complex API |
| MotionEye | Little maintained, no person detection, no acceleration, no API |
| Reimplementing the pipeline | Months of work for a worse result, outside Vyzio's value |
| Modifying or forking Frigate | Every upstream release would have to be merged by hand |
| The user edits the configuration, or uses Frigate's own configuration screens | Breaks UI-04 and principle 2, and leaves the truth in a file nobody validates |
| Patching fragments of the configuration | A partial mutation cannot be traced nor reproduced from the database |
| Reading the engine status from the container's state | A running container may still be loading its configuration; couples the status to the container engine |
| The adapter republishing Frigate's events on Vyzio MQTT topics | Renaming Frigate's events adds nothing inside one process; a Vyzio topic is justified only if it carries what Frigate lacks (the resolved person) for an outside integration, a product need of its own |
| Consuming Frigate's motion and statistics topics | Not needed by the product flow; statistics are read over REST when asked |
| Handing the browser Frigate's address | Frigate exposed, unauthenticated, to the home network |
| Frigate's interface as an advanced layer or an expert fallback, reached from Vyzio's settings | It shows and names the engine (principle 2, UI-02), needs Frigate reachable from the browser, and splits the product in two; depth lives in Vyzio's own settings (UI-09), diagnosis in the technical detail of an error (UI-01) |
