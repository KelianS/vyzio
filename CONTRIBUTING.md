# Contributing

## Setup

1. Install .NET SDK, Node.js, pnpm, and Docker.
2. Review `config/vyzio.yml` and `config/frigate.dev.yml`.
3. Replace the placeholder RTSP URL in `config/frigate.dev.yml` and enable `test_camera` only when you are ready to validate a real stream.
4. Start the local runtime with `docker compose up --build`.
5. Open `http://127.0.0.1:8443/health` for the API and `http://127.0.0.1:5000` for the Frigate UI when the override file is active.

## Local runtime contract

- `docker-compose.yml` is the minimal retained runtime: `vyzio-api` + `frigate`, nothing else.
- `docker-compose.override.yml` only exposes developer-facing ports and development environment overrides.
- `config/frigate.dev.yml` is a fallback boot config for repository reset work. It is intentionally minimal and keeps the sample camera disabled until a real stream is available.
- MQTT is not part of the default boot path yet; it will be introduced with the Frigate integration slice that actually consumes it.

## Project layout

- src/vyzio: backend (.NET)
- src/dashboard: frontend (React + TypeScript)
- src/proto: reserved for future inter-service contracts if a retained need appears
- config: runtime configuration templates

## Quality gates

- dotnet build src/vyzio/Vyzio.sln
- pnpm --dir src/dashboard build

## Workflow

The mandatory workflow is defined in the repository rules file: `.instructions.md`.

Use this file as the single source of truth for sequencing documentation, implementation, tests, and user-facing docs.

## Current status

The repository is in a reset phase. Before adding new features, align changes with docs/SAD.md and docs/BACKLOG.md.
