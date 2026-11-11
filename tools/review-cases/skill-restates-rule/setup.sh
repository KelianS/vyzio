#!/usr/bin/env bash
# A skill restates the commit format instead of citing its rule.
set -euo pipefail
cat >> .claude/skills/deliver/SKILL.md <<'MD'

## 7. Commit

A commit subject is `type(scope): subject`, in English, imperative, lowercase, with no trailing
period and 72 characters or fewer; its body says the why, in ASCII.
MD
