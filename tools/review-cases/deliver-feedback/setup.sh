#!/usr/bin/env bash
# A task description is translated to English, with no other change.
set -euo pipefail
sed -i 's/desc: Liste les tasks disponibles/desc: Lists the available tasks/' Taskfile.yml
grep -q 'desc: Lists the available tasks' Taskfile.yml
