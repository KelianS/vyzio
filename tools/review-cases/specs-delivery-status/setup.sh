#!/usr/bin/env bash
# The SPECS gains a sentence carrying a date, a delivery status and an issue number.
set -euo pipefail
cat >> docs/SPECS.md <<'MD'

L'export des donnees n'est pas encore livre (prevu pour juin 2027, voir #69) ; pour l'instant, seule
la suppression d'un profil efface ses photos.
MD
