# Contributing

## Setup

1. Install .NET SDK, Node.js, pnpm, and Docker.
2. Copy and adapt configuration in config/vyzio.yml and config/frigate.yml.template.
3. Start infrastructure with docker compose up -d.

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
