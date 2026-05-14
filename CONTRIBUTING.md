# Contributing

## Setup

1. Install .NET SDK, Node.js, pnpm, and Docker.
2. Review `config/vyzio.yml`, `config/frigate.dev.yml`, `config/frigate.mock.yml`, and `config/mosquitto.conf`.
3. Replace the placeholder RTSP URL in `config/frigate.dev.yml` and enable `test_camera` only when you are ready to validate a real stream.
4. Start the local runtime with `docker compose -f docker-compose.yml -f docker-compose.override.yml up --build`.
5. Open `http://127.0.0.1:8443/health` for the API and `http://127.0.0.1:5000` for the Frigate UI when the override file is active.
6. Use `127.0.0.1:1883` only for local MQTT inspection or tooling when the override file is active.

## Mock video stream

- Start the synthetic RTSP stack with `docker compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.mock.yml up -d mqtt mediamtx mock-camera frigate`.
- This swaps Frigate onto `config/frigate.mock.yml`, enables `test_camera`, and publishes a synthetic 1280x720 RTSP stream at `rtsp://mediamtx:8554/test-camera`.
- The same compose overlay is suitable for transport-level end-to-end tests because it removes the dependency on a physical camera.
- For future detection-level end-to-end tests, keep this same stack and replace the FFmpeg `lavfi` source with a repository-owned sample clip that contains known Frigate-detectable scenes.

## Local runtime contract

- `docker-compose.yml` is the minimal retained runtime: `vyzio-api` + `mqtt` + `frigate`, nothing else.
- `docker-compose.override.yml` only exposes developer-facing ports and development environment overrides.
- `config/frigate.dev.yml` is a fallback boot config for repository reset work. It is intentionally minimal and keeps the sample camera disabled until a real stream is available.
- `docker-compose.mock.yml` is an optional overlay for development and automated transport tests. It adds a synthetic RTSP source without changing the nominal runtime path.

## Frigate responsibilities in dev

- Frigate owns video ingestion, detection, local recordings, and its own SQLite state.
- MQTT is provided by a dedicated Mosquitto broker on the Docker network; Frigate publishes there and Vyzio can consume the same broker in later slices.
- The sample camera stays disabled until a real RTSP stream is available; enabling it is the only manual step needed to validate a test stream locally.
- The mock overlay can enable `test_camera` automatically against a synthetic RTSP source when no physical camera is available.
- The effective product config remains Vyzio-managed in the target architecture. `config/frigate.dev.yml` is only a temporary fallback for repository restart work.
- The fallback config is mounted read-only on purpose. If a future Frigate version requires a config migration, refresh `config/frigate.dev.yml` in the repo instead of relying on in-container rewrite.

## Project layout

- src/vyzio: backend (.NET)
- src/dashboard: frontend (React + TypeScript)
- config: runtime configuration templates
- docs: architectural and strategic documentation

## Workflow

The mandatory workflow is defined in the repository rules file: `.instructions.md`.

Use this file as the single source of truth for sequencing documentation, implementation, tests, and user-facing docs.
