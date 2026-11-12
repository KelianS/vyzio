#!/usr/bin/env bash
# A use case gains a local rule that restates a cross-cutting rule of the SPECS instead of citing it.
set -euo pipefail
python3 - <<'PY'
path = 'docs/uc/cam-06-verifier-une-camera.md'
text = open(path, encoding='utf-8', newline='').read()
text = text.replace('## Règles locales\n\nAucune.', """## Règles locales

- une erreur de vérification se lit à deux niveaux : une phrase claire, sans jargon, qui dit quoi faire, puis le détail technique complet, ce qui a été demandé et ce qui a répondu, pour le support qui reçoit une photo de l'écran.""")
open(path, 'w', encoding='utf-8', newline='').write(text)
PY
