#!/usr/bin/env bash
# Tied to closed issue #328: a branch for it makes the need form ask for the implementation tasks.
set -euo pipefail
cat >> .github/ISSUE_TEMPLATE/problem.yml <<'YML'
  - type: textarea
    id: tasks
    attributes:
      label: Tasks
      description: The implementation steps, one checkbox each, ticked as they are done.
    validations:
      required: true
YML
