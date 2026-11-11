#!/usr/bin/env bash
# A use case loses a failure path, and the rule behind it, with nothing said about why.
set -euo pipefail
python3 - <<'PY'
import re
path = 'docs/uc/hist-03-supprimer-une-detection.md'
text = open(path, encoding='utf-8', newline='').read()
text = re.sub(r"\| E1 \|[^\n]*\n", '', text)
text = re.sub(r"### E1 · [^\n]*\n\n[^\n]*\n\n", '', text)
text = re.sub(r"- \*\*HIST-13\*\*[^\n]*\n", '', text)
open(path, 'w', encoding='utf-8', newline='').write(text)
PY
