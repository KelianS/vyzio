# Vyzio, Software Architecture Document (SAD)

> July 2026 · v2.3 · Living document

---

## Table of contents

1. [Introduction and scope](#1-introduction-and-scope)
2. [Positioning against Frigate](#2-positioning-against-frigate)
3. [Constraints and guiding principles](#3-constraints-and-guiding-principles)
4. [Architecture overview](#4-architecture-overview)
5. [Architecture decisions (ADR)](#5-architecture-decisions-adr), full index in [`adr/README.md`](adr/README.md)
6. [Service architecture](#6-service-architecture)
7. [Data model](#7-data-model)
8. [Deployment architecture](#8-deployment-architecture)
9. [Security](#9-security)
10. [Performance and scalability](#10-performance-and-scalability)
11. [Risks and mitigations](#11-risks-and-mitigations)

---

## 1. Introduction and scope

This document states the architecture decisions of the **Vyzio** system, a local-first home
surveillance product aimed at a non-technical audience.

**Core philosophy**: do not reinvent what already exists and works. Vyzio is a **product layer on top
of Frigate**. Frigate covers the video pipeline and a good deal of AI enrichment. Vyzio concentrates on
non-technical accessibility: installation, onboarding, guided configuration, business rules,
multi-channel notifications, support and turnkey packaging.

### Audience

Engineers contributing to the project. Assumed knowledge: .NET 10, React and TypeScript, event-driven
architecture.

---

## 2. Positioning against Frigate

### 2.1 What Frigate does, and Vyzio does NOT reimplement

| Feature | Handled by |
|---|---|
| RTSP / ONVIF / MJPEG stream ingestion | **Frigate** |
| ONVIF camera discovery | **Frigate** |
| Motion detection | **Frigate** |
| Human presence detection (TFLite / OpenVINO / Coral) | **Frigate** |
| MP4 recording and event clips | **Frigate** |
| Clip retention policy | **Frigate** |
| Hardware acceleration support (Coral TPU, GPU, VAAPI) | **Frigate** |
| REST API and MQTT events | **Frigate** (consumed by Vyzio) |
| Live camera preview (HLS / MJPEG) | **Frigate** (proxied by Vyzio) |
| Local face recognition | **Frigate** (v0.16+) |
| Local licence plate recognition (LPR) | **Frigate** (v0.16+) |
| Semantic search and triggers | **Frigate** (v0.15+) |
| Local classification (bird, object, state) | **Frigate** (v0.16/v0.17) |
| Audio events and local transcription | **Frigate** |
| Native WebPush notifications | **Frigate** |

### 2.2 What Frigate does NOT do: Vyzio's added value

| Feature | Vyzio |
|---|---|
| **Plug and play installation** (appliance plus bootstrap) | ✅ Vyzio Hub |
| **Guided camera onboarding** (scan, test, naming, zones) | ✅ Vyzio Dashboard |
| **Product profiles and business rules** (household, delivery, time windows, priorities) | ✅ Vyzio Core |
| **Smart multi-channel notifications** (Telegram, Discord, ntfy, webhook, email) | ✅ Notification Service |
| **Use away from home**: commands over messaging, guided remote access with no public exposure | ✅ Vyzio Core |
| **Consumer UI**: simplified journey, mobile-first, non-technical wording | ✅ Dashboard React |
| **All-in-one packaging**: shipped ready to plug in, zero technical configuration | ✅ Hub + Compose / Appliance |
| **French-language support** and non-technical documentation | ✅ Product |

### 2.3 The dependency on Frigate: risks and mitigations

| Risk | Likelihood | Mitigation |
|---|:---:|---|
| Breaking change in the Frigate API | Low (API stable since v0.12) | A versioned `FrigateAdapter` abstraction layer |
| The Frigate project stops | Very low (active community, Home Assistant integration) | The architecture allows another MQTT/REST backend to replace Frigate |
| A Frigate bug affecting Vyzio | Medium | Integration tests on the MQTT/REST contract, not on Frigate internals |

### 2.4 Non-technical UX strategy: the comparison

The product goal is to make Frigate usable by a non-technical user with no exposure to YAML, brokers,
`ffmpeg` roles or AI tuning.

| Option | Description | Upside | Downside | Verdict |
|---|---|---|---|---|
| **A, expose the Frigate UI only** | Sell a Frigate appliance with minimal branding and support | Fastest time to market, little UI development | Onboarding and camera configuration far too technical for a general audience | ❌ Falls short of the Vyzio promise |
| **B, a fully custom Vyzio UI with no Frigate UI** | Rebuild the whole experience, advanced functions included | Total UX control | Very high cost, duplication of Frigate features, risk of delay | ❌ Too expensive, misaligned with "do not reinvent" |
| **C, hybrid (recommended)** | **A simplified Vyzio Hub by default** plus **advanced Frigate access** (expert mode) | Coherent non-technical UX, Frigate's power retained, good velocity | Requires sound governance of the UI boundaries | ✅ The best product and technical compromise |

**Strategic decision**: Vyzio adopts the **hybrid** approach. The main journey goes through the Vyzio
Hub (installation, onboarding, simplified configuration). The Frigate UI stays available in advanced
mode for expert users and for support.

---

## 3. Constraints and guiding principles

### 3.1 Hard constraints

| # | Constraint | Source |
|---|---|---|
| C1 | Biometric data (embeddings, frames) never leaves the local network | Specs §8.2 |
| C2 | The system works without an internet connection | Specs §5.3 |
| C3 | Deployment on a mini PC (Intel NUC, Raspberry Pi 5, NAS) | Specs §1.3 |
| C4 | Plug and play installation with no technical skill required | Specs §1.3 |
| C5 | RTSP, ONVIF and HTTP MJPEG support | Delegated to Frigate |
| C6 | Face recognition under 2s after motion is detected | Architecture constraint derived from the product goals |
| C7 | No cloud dependency for critical functions | Specs §8.2 |
| C8 | Target stack: .NET 10 plus TypeScript (main runtime) | [`../CONTRIBUTING.md`](../CONTRIBUTING.md) |

### 3.2 Guiding principles

- **Do not reinvent Frigate**: any feature Frigate covers is delegated to it.
- **Pragmatic delegation to Frigate**: the enrichments already reliable in Frigate (face, LPR, semantic
  search, classification, audio) are used by default.
- **Explicit documented choices**: every feature follows the grid _options compared, solution chosen,
  consequences_.
- **A dedicated Python worker was not retained**: kept only as an option studied, not in the target
  architecture.
- **Loose coupling between Frigate and Vyzio**: Vyzio consumes Frigate through its public interfaces
  (MQTT and REST), not its internals.
- **Local-first**: no image and no biometric data leaves the network without an explicit opt-in.
- **Product-driven**: technical decisions serve the consumer experience, not technical exhaustiveness.

---

## 4. Architecture overview

### 4.1 Context diagram (C4 level 1)

```
┌────────────────────────────────────────────────────────────────┐
│  The user's local network                                      │
│                                                                │
│  ┌─────────────┐  RTSP/ONVIF  ┌──────────────────────────────┐ │
│  │  IP cameras │────────────► │         Vyzio                │ │
│  └─────────────┘              │  (Frigate + product layer)   │ │
│                               │                              │ │
│  ┌─────────────┐  HTTP(S)     │  Dashboard + API             │ │
│  │   Browser   │◄───────────► │                              │ │
│  └─────────────┘              └──────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
                                          │
                                   FCM (push only:
                                   text payload + signed URL)
                                          │
                             ┌────────────▼────────────┐
                             │  Phone (Android / iOS)  │
                             └─────────────────────────┘
```

### 4.2 Container diagram (C4 level 2)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Vyzio Runtime (Docker Compose / Appliance)                              │
│                                                                          │
│  ┌──────────────────────────┐     MQTT publish/subscribe                 │
│  │  Frigate                 │──────────────┐                             │
│  │  (Python, unmodified)    │              │                             │
│  │  - RTSP/ONVIF ingestion  │              ▼                             │
│  │  - Detection / clips     │   ┌──────────────────────┐                 │
│  │  - REST API :5000        │   │  Mosquitto Broker    │                 │
│  └──────────────┬───────────┘   │  - MQTT :1883        │                 │
│                 │ REST          └──────────┬───────────┘                 │
│                 │ (clips, live HLS)        │ MQTT                        │
│                 ▼                          ▼                             │
│  ┌────────────────────────────────────────────────────────────────┐      │
│  │  Vyzio Backend  (.NET 10)                                      │      │
│  │                                                                │      │
│  │  ┌──────────────────┐  ┌─────────────────┐  ┌──────────────┐   │      │
│  │  │  FrigateAdapter  │  │ Profile & Rules │  │  Storage     │   │      │
│  │  │  (MQTT consumer  │  │ Service         │  │  Service     │   │      │
│  │  │  + REST client)  │  │ (mapping,       │  │  (events DB) │   │      │
│  │  └────────┬─────────┘  │ schedules,      │  └──────────────┘   │      │
│  │           │            │ priorities)     │           │         │      │
│  │           │            └────────┬────────┘           │         │      │
│  │           │ MQTT (vyzio/events/*)│                   │         │      │
│  │           └──────────────────────┬───────────────────┘         │      │
│  │                                  ▼                             │      │
│  │                         ┌─────────────────┐                    │      │
│  │                         │  Notification   │                    │      │
│  │                         │  Service        │                    │      │
│  │                         │ (Telegram,      │                    │      │
│  │                         │  FCM, webhook)  │                    │      │
│  │                         └─────────────────┘                    │      │
│  └──────────────────────────────┬─────────────────────────────────┘      │
│                                 │ HTTPS                                  │
│  ┌──────────────────────────────▼───────────────────────────────────┐    │
│  │  Vyzio Dashboard  (React 19 + TypeScript, static build)          │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Architecture decisions (ADR)

Architecture decisions are recorded as **individual ADRs** under [`adr/`](adr/), one file per decision,
in the format Context, Options compared, Decision, Consequences. See the **index**:
[`adr/README.md`](adr/README.md).

The implementation detail of a component (protocol frames, catalogues, schemas) lives in a **TAD** under
[`design/`](design/), not here. Writing rules: [`WORKFLOW.md`](WORKFLOW.md).

## 6. Service architecture

### 6.1 Responsibilities

```
Frigate                           -> Raw video, detection, clips, face recognition library
Mosquitto Broker                  -> The MQTT bus shared between Frigate and Vyzio
FrigateAdapter (.NET)             -> Bridge from Frigate to the Vyzio domain (MQTT consumer + REST client)
FrigateRestClient (.NET)          -> Frigate REST calls: sub_label, face photo upload, library
Profile & Rules Service (.NET)    -> Product profiles, sub_label to profile mapping, profile/camera filter, alert rules
Notification Service (.NET)       -> Alert rules and delivery to every active channel behind a single port (ADR-50)
Command Registry (.NET)           -> Declaration of the remote commands: typed parameters, authorisation, structured result (ADR-50)
Channel Ingress (.NET)            -> Outbound retrieval of a channel's messages, pairing, execution through the existing use cases (ADR-50/52)
Storage Service (.NET)            -> Persistence of Vyzio's own data (EF Core), never the detections (ADR-49)
DetectionHistoryReader (.NET)     -> Reads the Frigate events, filtered and enriched on read (profile, camera name, media)
FaceLibrarySyncService (.NET)     -> Synchronises the Vyzio profile photos into the Frigate library
CameraConfigWriter (.NET)         -> Generates frigate.yml: cameras, detection labels, face_recognition, detect/record roles
CameraStreamEnumerator (.NET)     -> Enumerates a camera's streams and their resolution (ADR-38), through ONVIF or protocol convention
MotionSensitivityTuner (.NET)     -> Per-camera sensitivity self-tuning loop (ADR-35), applied live over MQTT
API (ASP.NET Core)                -> REST + SignalR + authenticated Frigate proxy
Dashboard / Hub (React + TS)      -> Guided consumer UI: viewing and a settings tree (ADR-40), a single editing cycle (ADR-41), the shadcn/ui foundation (ADR-42)
```

### 6.2 The full flow: detection to notification

```
1. Frigate detects a person (the face library is already synced by FaceLibrarySyncService)
   |-> Frigate face recognition: compared against the library, sub_label = "Alice" on a match
   |-> MQTT publish: frigate/events { label: "person", sub_label: "Alice", camera: "front_door" }

2. The dedicated Mosquitto broker
   |-> Carries frigate/events to the Vyzio consumers

3. FrigateAdapter (.NET), subscribed to frigate/events
   |-> Persists nothing: the detection belongs to Frigate (ADR-49)
   |-> Keeps only the end of an event, filters the labels, then queues the detection
   |-> Returns immediately, with no waiting inside the message handler

4. NotificationService, consuming the queue outside the MQTT handler
   |-> Re-reads the identity from Frigate (sub_label "Alice"). Resolving the profile itself
       belongs to reading the history (ADR-15)
   |-> Fetches the media with retries (Frigate finalises it a few seconds after the end),
       and falls back to text when nothing comes
   |-> Hands the message and its media to every active channel, which renders it its own way:
       "Alice est arrivee • Porte d'entree • 09:32" plus a photo
   |-> Logs the send, per channel, anchored on the Frigate event id, the only fact persisted
   |-> SignalR: pushes to an open dashboard

4bis. Browsing the history (independent of the flow above)
   |-> DetectionHistoryReader reads /api/events (camera, label, identity and period filters;
       pagination on a time cursor), enriching profile and camera name on read
   |-> The depth of the history is the retention of the event clips
   |-> Two absences, two distinct causes, stated on screen only (ADR-49): a medium past its
       retention is marked expired on read; unreachable surveillance answers 503, because no
       history is anything other than an empty history

5. The library sync flow (independent of the detection flow):
   FaceLibrarySyncService
   |-> Triggered by: adding or removing a profile photo, renaming a profile
   |-> POST /api/faces/{name}, uploads the photo to Frigate
   |-> Updates profile_photos.frigate_synced = 1
   |-> When face_recognition is enabled: regenerates frigate.yml through CameraConfigWriter
```

---

## 7. Data model

### 7.1 Scope

Vyzio manages only its own data (profiles, cameras, settings, notifications, sessions). Detection events
and their media stay in the Frigate database. Vyzio reads them through the REST API and enriches them on
read, never keeping a copy (ADR-49).

### 7.2 Entities and relations

> Source of truth: the EF entities (`src/vyzio/Vyzio.Core/Entities/`) and the migrations
> (`src/vyzio/Vyzio.Infrastructure/Persistence/Migrations/`). This table gives the **role and the
> relations**; columns, indexes and default values live in the code and are not copied here.

| Entity | Role | Key relations |
|---|---|---|
| `Profile` | A recognised person or animal: category plus alert mode | <- `ProfilePhoto`, `ProfileCameraLink` |
| `ProfilePhoto` | A reference photo synced to Frigate (ADR-13) | -> `Profile` |
| `ProfileCameraLink` | Profile/camera recognition filter (ADR-15) | -> `Profile`, `Camera` |
| `Camera` | A camera: **one scene**, connection, status, privacy mode, detected protocols (ADR-38) | <- `CameraCapabilityBinding`, `ProfileCameraLink`, `CameraStream` |
| `CameraStream` | A camera's video access point: quality, path, measured resolution (ADR-38) | -> `Camera` |
| `CameraCapabilityBinding` | An optional capability (PTZ, hardware privacy, image) decoupled from the brand, **tested and never declarative** (ADR-22/24/28) | -> `Camera` |
| `RecordingSettings` | The installation's retention durations, overridable per camera (ADR-39) | singleton |
| `Notification` | A per-channel send for one event, anchored on the Frigate id. **The only fact persisted about a detection**: the detections themselves are not stored (ADR-49) | |
| `ChannelPairing` | A conversation allowed to issue commands on a channel, revocable; any other origin is ignored (ADR-50) | -> the channel's config |
| `CommandJournal` | A received command: origin, command, outcome, timestamp. A fact Vyzio alone holds, and the only trace should a pairing leak (ADR-50) | -> `ChannelPairing` |
| `Account` | One human access to the installation: hashed password and **role**. Exactly one account and one role are populated today; the axis exists from the first migration because it cannot be retrofitted (ADR-54) | <- `Session` |
| `Session` | An access opened from a device, referenced by an opaque cookie; revocable one at a time or all at once (ADR-54) | -> `Account` |

Secondary entities (PTZ positions, privacy schedules, image settings, notification channel
configuration) are in the entities folder.

**Data invariants** (architecture constraints, not column detail):
- Vyzio stores **no biometric embedding and no frame**, only business metadata and the Frigate
  reference (`frigate_event_id`) used to proxy clips and thumbnails.
- Camera credentials are **encrypted at rest** (`Microsoft.AspNetCore.DataProtection`, §9.1).
- The owner's password is **never stored nor encrypted, only hashed**: encryption can be undone, and
  nothing in the product needs to read a password back (ADR-54). Its column is **nullable**: an account
  without a password is one whose host has just removed it, and it opens nothing until a new one is
  chosen.
- A camera capability is never enabled without a real test passing (`verified`, ADR-28).
- A `Camera` describes **a single scene**: its `CameraStream` rows are qualities of it, never different
  viewing angles. A multi-lens unit gives N `Camera` rows grouped by device (ADR-38).
- An installation setting is overridden per camera through a **nullable** column on `Camera`; `null`
  means "follow the installation" and never a disguised value. Resolving `override ?? global` has a
  single point in `Core`, shared by configuration generation and the API boundary (ADR-39).

---

## 8. Deployment architecture

### 8.1 Docker Compose (self-hosted)

Four containers on an internal Docker network. The real file is
[`docker-compose.yml`](../docker-compose.yml):

- **vyzio-dashboard** serves the interface and relays the API. It is the **only service published to
  the user**.
- **vyzio-api** is Core plus the API, reachable only from the Docker network. It holds the **host's
  Docker socket**, which is how a written configuration reaches a running Frigate, and therefore holds
  root-equivalent access to the machine.
- **mqtt** (Mosquitto) is the event bus, with no published port.
- **frigate** is the video pipeline, its API bound to `127.0.0.1` (never exposed to the network), with
  optional hardware access (VAAPI, Coral).

Three properties hold the security of this split: **a single entry point** for the user, **a single
authentication boundary** behind which everything sits (ADR-54), and **Frigate never directly
reachable**, everything going through the Vyzio proxy (ADR-07/16/17).

The split concentrates rather than divides privilege: `vyzio-api` is the container that speaks to the
cameras and the one that can restart anything on the host. The command it runs to do so is read once
from the environment at startup and is never writable through the API, so no request can choose it.

> **Target against reality, the only gap in this document.** The entry point is **in the clear
> (HTTP)**: no TLS, no certificate, no redirect. The target is an encrypted entry point (annex A); until
> it is, the session id and the password travel in the clear on the local network, and remote access
> (ADR-51) cannot be announced. Tracked in
> [issue #67](https://github.com/KelianS/vyzio/issues/67).

### 8.2 Guided onboarding (zero YAML for the user)

```
Vyzio Dashboard, configuration assistant
  Step 0: Create the owner's password (ADR-54), nothing else is reachable before it
  Step 1: Network scan, listing the ONVIF cameras found
  Step 2: Selection, connection test and live preview
  Step 3: Naming ("Porte d'entree") and detection zones (canvas)
          -> Vyzio generates frigate.yml, then docker compose restart frigate
  Step 4: Add the first profile (photo upload)
  Step 5: Test a push notification
  -> Surveillance is live
```

---

## 9. Security

### 9.1 Threat model

| Threat | Surface | Mitigation |
|---|---|---|
| Unauthorised dashboard access | Local network | Owner account, revocable server session in an `httpOnly` cookie, login rate limiting (ADR-54). **Transport encryption is still to be delivered**, see §8.1 |
| Session theft by an injected script | Browser | An `httpOnly` cookie: the session is never readable from the page (ADR-54) |
| A lost device keeping its access | Open session | Sessions stored in the database, revocable one at a time or all at once (ADR-54) |
| A third party knowing the password | Open session | Changing the password from the interface, which closes every session on the way (ADR-54) |
| The installation seized during a reset | Local network | Accepted and bounded: the window lasts 30 minutes, opens on a deliberate gesture from the host, and closes on a full lock (ADR-54) |
| Direct access to the Frigate API | Local network | Frigate bound to `127.0.0.1`, not routable outside Docker |
| Exfiltration of Frigate biometric data | Vyzio API | Vyzio stores no embeddings; only business metadata is exposed |
| Image interception off the network | Messaging channel | HTTPS, and no intermediary decrypting the product's traffic (ADR-51) |
| Remote access to the hub | Overlay network | End-to-end encryption, the hub a peer rather than a gateway: the local network is not advertised (ADR-51) |
| An unauthorised command from a messaging channel | Inbound channel | The conversation is explicitly paired and revocable; any other origin is ignored without an answer (ADR-50) |
| Injection through EF Core | API | Parameterised queries only, no raw SQL |
| **Code execution in `vyzio-api` reaching the host** | Docker socket | Accepted and bounded, see §8.1: the socket is what applies a configuration, the command that uses it comes from the environment at startup and no route can write it, and the container is not published. Whoever executes code there holds the machine |
| Camera credentials in the clear | SQLite | Encryption through `Microsoft.AspNetCore.DataProtection` |
| Password brute force | Login route | Rate limiting on the login route alone (ADR-54) |

### 9.2 Network isolation

```
Outside the home (optional, ADR-51)
  |-> Messaging channel ---> commands (ADR-50) -----|
  |-> Overlay network ------> Vyzio entry point ----|
                                                   |
Local network                                      |
  |-> Browser --------------> Vyzio entry point ----|
                                        |
                                    Vyzio API
                                        |
Docker internal network (not routable from outside)
  |-- vyzio --> frigate:5000    (HTTP REST)
  |-- vyzio --> mqtt:1883       (MQTT)
  |-- internal Vyzio components (API + services)
```

---

## 10. Performance and scalability

### 10.1 Resource budget, Intel NUC i5, 8 GB RAM

| Container | Target RAM | Notes |
|---|---|---|
| Frigate | 400-800 MB | Varies with the number of cameras and the AI model |
| Vyzio Core + API (.NET 10 NativeAOT) | ~150 MB | NativeAOT cuts the footprint significantly |
| **Total** | **~0.9-1.1 GB** | The target profile, without a dedicated Python worker |

### 10.2 Recognition pipeline latency (CPU only)

| Step | Owner | Estimated time |
|---|---|---|
| Person detection | Frigate TFLite | ~50ms |
| Face enrichment (default mode) | Frigate | ~100-400ms |
| Business rules and notification dispatch | Vyzio | ~5-20ms |
| FCM push | Notification Service | ~200ms of network |
| **Total as perceived (default mode)** | | **~350-700ms** |

With a **Coral Edge TPU** (Frigate) plus a **GPU** (Frigate enrichments), perceived latency drops
significantly.

---

## 11. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|:---:|:---:|---|
| Breaking change in the Frigate API or MQTT contract | Low | Medium | A versioned `FrigateAdapter`, MQTT contract tests |
| The Frigate project stops | Very low | High | A decoupled architecture, `FrigateAdapter` replaceable |
| Face recognition false positive | Medium | High | Configurable threshold, an "uncertain" mode, confirmation from the notification |
| A camera incompatible with Frigate | Medium | Low | Frigate supports over 200 models, plus a manual RTSP fallback |
| Functional drift in Frigate (fast-moving releases) | Medium | Medium | Version pinning, a compatibility matrix, regression tests |
| Debt from reimplementing Frigate features | Medium | High | A delegate-by-default policy (ADR-03) |
| Pressure to rebuild Frigate features | Medium | High | ADR discipline: compare the options and keep the ones not chosen |
| Disk space saturated (Frigate clips) | Medium | Medium | The Frigate retention policy configured by Vyzio, plus dashboard alerts |
| CPU performance without a GPU | Medium | Medium | ~500ms is acceptable, the Coral TPU recommendation is documented |

---

## Annex A: technology choices at a glance

| Component | Technology | Alternative rejected | Reason |
|---|---|---|---|
| Video pipeline | **Frigate** (open source) | A custom reimplementation | Do not reinvent what exists |
| Main language | **.NET 10 (C#)** | Rust | Velocity plus a coherent ecosystem (ASP.NET, EF Core, SignalR) |
| Face recognition (default) | **Frigate native** | A mandatory custom worker | Less debt, simpler maintenance |
| Event bus | **MQTT** (a dedicated Mosquitto) | MediatR (rejected), Redis Streams (v2) | A light dependency, continuity with Frigate |
| Database | **SQLite** | PostgreSQL | Zero infrastructure, plug and play, a single file |
| API | **ASP.NET Core Minimal APIs** | FastAPI (Python) | Coherence with the .NET stack |
| WebSocket | **SignalR** | Raw WebSocket | Automatic reconnection |
| Dashboard | **React 19 + TypeScript** | SvelteKit | Contributor pool, UI ecosystem |
| UI components | **shadcn/ui + Tailwind** | Material UI | Accessibility, customisable without a designer |
| Zone canvas | **React-Konva** | Fabric.js | Native React integration |
| Notification channels | **Telegram, Discord**, adapters behind a single port | FCM | A native image off the network, no privileged channel (ADR-50) |
| Channels considered | ntfy, email, webhook | WhatsApp (outbound only) | Depending on user preference |
| Auth | **JWT + bcrypt + refresh tokens** | OAuth2 / Keycloak | Local-first |
| TLS | **A self-signed certificate** (target, not delivered, §8.1) | Let's Encrypt | Works offline, without depending on a public domain |
| Remote access to the interface | **A NetBird overlay network**, opt-in, operated by the user | A web publishing tunnel, port forwarding, a Vyzio relay | ADR-51 |
| Everyday remote use | **A bidirectional messaging channel** | Mandatory network access | ADR-50, it makes network access optional |
| Receiving commands | **The channel's native bot, outbound retrieval** | An inbound webhook | No public address; commands published in the channel's own grammar (ADR-52) |

---

## Annex B: code organisation

A monorepo under `src/`. The .NET backend is in hexagonal layers: `Vyzio.Core` (domain and interfaces),
`Vyzio.Application` (use cases), `Vyzio.Infrastructure` (EF/SQLite, MQTT, protocol clients,
`FrigateAdapter`), `Vyzio.Api` (ASP.NET Core and SignalR); the tests live in `Vyzio.Tests`. The frontend
is `src/dashboard/` (React 19 and TypeScript, mirroring domain/application/infrastructure/ui). Setup,
tasks and the folder detail: [`../CONTRIBUTING.md`](../CONTRIBUTING.md).

---

## Annex C: options studied and not retained

| Feature | Option not retained | Why not now | Condition for revisiting |
|---|---|---|---|
| Face recognition | A dedicated Python worker (InsightFace plus gRPC) | Duplicates Frigate, complicates operations | A business need Frigate does not cover, or a specific accuracy constraint |
| Main API | FastAPI or Node | Introduces an additional main runtime | A major change of team or stack |
| Database | PostgreSQL | Operational overhead for a local-first offer | A move to multiple nodes or high write concurrency |
| UI | A fully custom UI without Frigate | High cost and long delays, duplicated capabilities | A strong product need unreachable through the hybrid approach |
