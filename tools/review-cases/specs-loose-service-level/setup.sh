#!/usr/bin/env bash
# A cross-cutting rule of the SPECS gains a timing in loose words, with no service level.
set -euo pipefail
python3 - <<'PY'
path = 'docs/SPECS.md'
text = open(path, encoding='utf-8', newline='').read()
old = '- **SYS-03** · la surveillance locale doit continuer sans Internet ;'
text = text.replace(old, '- **SYS-03** · la surveillance locale doit continuer sans Internet, et ses notifications reprendre quelques minutes apres le retour du reseau ;')
open(path, 'w', encoding='utf-8', newline='').write(text)
PY
