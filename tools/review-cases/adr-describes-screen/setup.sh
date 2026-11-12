#!/usr/bin/env bash
# A new ADR describes a screen and its wording, and is stacked as an amendment of another.
set -euo pipefail
cat > docs/adr/0073-the-camera-list-shows-a-banner.md <<'MD'
# ADR-73: The camera list shows a banner

## Context

Users miss that a camera stopped answering. This ADR amends ADR-72.

## Decision

The camera list shows a red banner at the top reading "Une caméra ne répond plus".

- A "Voir" button on the banner opens the camera page.

## Consequences

- ✅ The user sees at once that a camera stopped answering.
- ⚠️ The banner takes room above the list.

## Options rejected

| Option | Why rejected |
| --- | --- |
| A toast | It disappears before it is read |
MD
