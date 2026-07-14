# Contributing

## Get started

1. Install .NET SDK 10, Node.js 24, pnpm, Docker Engine 25+, and [go-task](https://taskfile.dev) (`winget install Task.Task`).
2. From the repo root, run `task up` to start the local runtime (API, Frigate, MQTT...).
3. Run `task front:dev` to start the frontend dev server.

All Vyzio settings default to production-ready values. Override any of them via `VYZIO_*` environment variables in `docker-compose.yml` (prod) or `docker-compose.dev.yml` (dev only).

### Task runner

`Taskfile.yml` at the repo root centralizes the commands for both projects so you don't have to `cd` into `src/dashboard` or `src/vyzio` (or shell out to WSL for docker) by hand. Run `task` with no arguments to list everything; the main ones:

| Task | What it does |
|---|---|
| `task up` / `task down` | Start/stop the dev docker stack |
| `task mock:up` / `task mock:down` | Start/stop the synthetic RTSP camera stack |
| `task front:dev` | Vite dev server |
| `task front:test` / `task back:test` / `task test` | Run frontend / backend / both test suites |
| `task front:lint` | ESLint |
| `task front:build` / `task back:build` / `task build` | Build frontend / backend / both |
| `task back:run` | Run the API locally outside docker |

Docker commands run via `wsl docker compose ...` under the hood, since Docker is only reachable through WSL on Windows dev machines.

### Environment variables reference

#### General

| Variable | Default | Description |
|---|---|---|
| `VYZIO_TIME_ZONE` | *(system TZ via `/etc/localtime`)* | IANA timezone, e.g. `Europe/Paris` |

#### Database

| Variable | Default | Description |
|---|---|---|
| `VYZIO_DATABASE_CONNECTION_STRING` | `Data Source=./data/vyzio.db` | SQLite connection string |

#### Frigate integration

| Variable | Default | Description |
|---|---|---|
| `VYZIO_FRIGATE_API_BASE_URL` | `http://frigate:5000` | Frigate REST API base URL |
| `VYZIO_FRIGATE_CONFIG_PATH` | `/config/config.yml` | Where Vyzio writes the generated Frigate config |
| `VYZIO_FRIGATE_APPLY_COMMAND` | `docker restart vyzio-frigate` | Shell command run after config is written. Set to empty string to disable. |
| `VYZIO_FRIGATE_DATABASE_PATH` | `/media/frigate/frigate.db` | Frigate SQLite DB path (read by Vyzio for clip/snapshot lookups) |
| `VYZIO_FRIGATE_RETAINED_LABELS` | *(all)* | Comma-separated Frigate labels Vyzio keeps, e.g. `person,car` |

#### MQTT

| Variable | Default | Description |
|---|---|---|
| `VYZIO_FRIGATE_MQTT_HOST` | `mqtt` | MQTT broker hostname |
| `VYZIO_FRIGATE_MQTT_PORT` | `1883` | MQTT broker port |
| `VYZIO_FRIGATE_MQTT_TOPIC` | `frigate/events` | Topic Frigate publishes events on |
| `VYZIO_FRIGATE_MQTT_CLIENT_ID` | `vyzio-api` | MQTT client identifier |

#### Camera discovery

| Variable | Default | Description |
|---|---|---|
| `VYZIO_DISCOVERY_AUTO_DETECT_LOCAL_CIDRS` | `false` | Auto-detect local subnets from network interfaces |
| `VYZIO_DISCOVERY_PROBE_HOSTS` | *(none)* | Comma-separated hosts to always probe, e.g. `192.168.1.10,192.168.1.20` |
| `VYZIO_DISCOVERY_PROBE_CIDRS` | *(none)* | Comma-separated CIDRs for unicast scan, e.g. `192.168.1.0/24` |
| `VYZIO_DISCOVERY_RTSP_PORTS` | `554` | Comma-separated RTSP ports to test |
| `VYZIO_DISCOVERY_RTSP_PATHS` | `/stream1,/stream2,/Streaming/Channels/101,...` | Comma-separated RTSP paths to probe |
| `VYZIO_DISCOVERY_HTTP_PORTS` | `80,443,8080` | Comma-separated HTTP ports to test |
| `VYZIO_DISCOVERY_ONVIF_PORTS` | `80,2020` | Comma-separated ONVIF ports to test |
| `VYZIO_DISCOVERY_PROBE_TIMEOUT_MS` | `250` | Per-host connection timeout in ms (50–5000) |
| `VYZIO_DISCOVERY_MAX_CONCURRENT_PROBES` | `32` | Max parallel probes (1–256) |

#### Documentation

| Variable | Default | Description |
|---|---|---|
| `VYZIO_DOCUMENTATION_VENDOR_CATALOG_PATH` | `/app/vendors` | Directory containing vendor Markdown docs (embedded in image) |

## Build Docker images

Both images must be built from the **repository root** (the Docker build context is `.`).

```bash
# Backend (.NET API)
docker build -f src/vyzio/Vyzio.Api/Dockerfile -t ghcr.io/kelians/vyzio-api:VERSION .

# Frontend (React dashboard + nginx)
docker build -f src/dashboard/Dockerfile -t ghcr.io/kelians/vyzio-dashboard:VERSION .
```

Push to GHCR:

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u KelianS --password-stdin

docker push ghcr.io/kelians/vyzio-api:VERSION
docker push ghcr.io/kelians/vyzio-dashboard:VERSION

# Update the latest tag on stable releases
docker tag ghcr.io/kelians/vyzio-api:VERSION     ghcr.io/kelians/vyzio-api:latest
docker tag ghcr.io/kelians/vyzio-dashboard:VERSION ghcr.io/kelians/vyzio-dashboard:latest
docker push ghcr.io/kelians/vyzio-api:latest
docker push ghcr.io/kelians/vyzio-dashboard:latest
```

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

The mandatory workflow is defined in [`docs/WORKFLOW.md`](docs/WORKFLOW.md).

Use it as the single source of truth for sequencing documentation, implementation, tests, and user-facing docs.

## Frigate responsibilities in dev

- Frigate owns video ingestion, detection, local recordings, and its own SQLite state.
- MQTT is provided by a dedicated Mosquitto broker on the Docker network; Frigate publishes there and Vyzio can consume the same broker in later slices.
- The sample camera stays disabled until a real RTSP stream is available; enabling it is the only manual step needed to validate a test stream locally.
- The mock overlay can enable `test_camera` automatically against a synthetic RTSP source when no physical camera is available.
- The effective product config remains Vyzio-managed in the target architecture. `config/frigate.dev.yml` is only a temporary fallback for repository restart work.
- The fallback config is mounted read-only on purpose. If a future Frigate version requires a config migration, refresh `config/frigate.dev.yml` in the repo instead of relying on in-container rewrite.
