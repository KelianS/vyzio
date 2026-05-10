# Contributing

## Setup

1. Install .NET SDK, Node.js, pnpm, and Docker.
2. Review `config/vyzio.yml`, `config/frigate.dev.yml`, and `config/mosquitto.conf`.
3. Replace the placeholder RTSP URL in `config/frigate.dev.yml` and enable `test_camera` only when you are ready to validate a real stream.
4. Start the local runtime with `docker compose up --build`.
5. Open `http://127.0.0.1:8443/health` for the API and `http://127.0.0.1:5000` for the Frigate UI when the override file is active.
6. Use `127.0.0.1:1883` only for local MQTT inspection or tooling when the override file is active.

## Local runtime contract

- `docker-compose.yml` is the minimal retained runtime: `vyzio-api` + `mqtt` + `frigate`, nothing else.
- `docker-compose.override.yml` only exposes developer-facing ports and development environment overrides.
- `config/frigate.dev.yml` is a fallback boot config for repository reset work. It is intentionally minimal and keeps the sample camera disabled until a real stream is available.

## Frigate responsibilities in dev

- Frigate owns video ingestion, detection, local recordings, and its own SQLite state.
- MQTT is provided by a dedicated Mosquitto broker on the Docker network; Frigate publishes there and Vyzio can consume the same broker in later slices.
- The sample camera stays disabled until a real RTSP stream is available; enabling it is the only manual step needed to validate a test stream locally.
- The effective product config remains Vyzio-managed in the target architecture. `config/frigate.dev.yml` is only a temporary fallback for repository restart work.
- The fallback config is mounted read-only on purpose. If a future Frigate version requires a config migration, refresh `config/frigate.dev.yml` in the repo instead of relying on in-container rewrite.

## Project layout

- src/vyzio: backend (.NET)
- src/dashboard: frontend (React + TypeScript)
- config: runtime configuration templates

## Quality gates

- dotnet build src/vyzio/Vyzio.sln
- pnpm --dir src/dashboard build

## Workflow

The mandatory workflow is defined in the repository rules file: `.instructions.md`.

Use this file as the single source of truth for sequencing documentation, implementation, tests, and user-facing docs.

## Current status

The repository is in a reset phase. Before adding new features, align changes with docs/SAD.md and docs/BACKLOG.md.
