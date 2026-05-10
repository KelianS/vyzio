# Contributing

## Setup

1. Install .NET SDK, Node.js, pnpm, and Docker.
2. Copy and adapt configuration in config/vyzio.yml and config/frigate.yml.template.
3. Start infrastructure with docker compose up -d.

## Project layout

- src/vyzio: backend (.NET)
- src/dashboard: frontend (React + TypeScript)
- src/face-worker: experimental option, not part of the default runtime path
- src/proto: reserved for future inter-service contracts if a retained need appears
- config: runtime configuration templates

## Quality gates

- dotnet build src/vyzio/Vyzio.sln
- pnpm --dir src/dashboard build

## Current status

The repository is in a reset phase. Before adding new features, align changes with docs/SAD.md and docs/BACKLOG.md.
