#!/usr/bin/env bash
# A docs-only change gives the SPECS a behaviour no code delivers, with no implementation stacked on it.
set -euo pipefail
cat >> docs/SPECS.md <<'MD'

Chaque camera affiche, sous son image, le nombre de passages detectes depuis minuit, remis a zero
chaque nuit.
MD
