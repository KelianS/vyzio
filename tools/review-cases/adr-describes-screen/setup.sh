#!/usr/bin/env bash
# A new ADR describes a screen and its wording, and is stacked as an amendment of another.
set -euo pipefail
cat > docs/adr/0073-the-camera-list-shows-a-banner.md <<'MD'
# ADR-73: The camera list shows a banner

> Status: Accepted, amends ADR-72

## Context

Users miss that a camera stopped answering.

## Decision

The camera list shows a red banner at the top reading "Une caméra ne répond plus", with a "Voir"
button that opens the camera page.

## Consequences

- The banner hides once every camera answers.

## Options rejected

- **A toast**: it disappears before it is read.
MD
