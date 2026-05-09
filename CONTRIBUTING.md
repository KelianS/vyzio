# Contributing

## Setup

1. Install .NET SDK, Node.js, Docker, and Python 3.12.
2. Copy and adapt configuration in config/vyzio.yml and config/frigate.yml.template.
3. Start infrastructure with docker compose up -d.

## Project layout

- src/vyzio: backend (.NET)
- src/dashboard: frontend (React + TypeScript)
- src/face-worker: Python worker scaffold
- src/proto: shared protobuf contracts
- config: runtime configuration templates

## Quality gates

- dotnet build src/vyzio/Vyzio.sln
- npm run build (from src/dashboard)
