# Contributing

## Get started

1. Install .NET SDK, Node.js, pnpm, and Docker.
2. Start the local runtime with `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build`
3. Start the frontend dev server with `cd src/dashboard; pnpm dev`

## Project layout

- src/vyzio: backend (.NET)
- src/dashboard: frontend (React + TypeScript)
- config: runtime configuration templates
- docs: architectural and strategic documentation

## Mock video stream
> If you don't have a physical camera available, you can still work on Frigate integration and related features using a synthetic RTSP stream.
- Start the synthetic RTSP stack with `docker compose -f docker-compose.yml -f docker-compose.mock.yml up -d`.
- This swaps Frigate onto `config/frigate.mock.yml`, enables `test_camera`, and publishes a synthetic 1280x720 RTSP stream at `rtsp://mediamtx:8554/test-camera`.

## Workflow

The mandatory workflow is defined in the repository rules file: `.instructions.md`.

Use this file as the single source of truth for sequencing documentation, implementation, tests, and user-facing docs.

## Frigate responsibilities in dev

- Frigate owns video ingestion, detection, local recordings, and its own SQLite state.
- MQTT is provided by a dedicated Mosquitto broker on the Docker network; Frigate publishes there and Vyzio can consume the same broker in later slices.
- The sample camera stays disabled until a real RTSP stream is available; enabling it is the only manual step needed to validate a test stream locally.
- The mock overlay can enable `test_camera` automatically against a synthetic RTSP source when no physical camera is available.
- The effective product config remains Vyzio-managed in the target architecture. `config/frigate.dev.yml` is only a temporary fallback for repository restart work.
- The fallback config is mounted read-only on purpose. If a future Frigate version requires a config migration, refresh `config/frigate.dev.yml` in the repo instead of relying on in-container rewrite.
