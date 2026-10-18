#!/usr/bin/env bash
# The SAD gains a sentence naming a class, a folder and tuned values.
set -euo pipefail
cat >> docs/SAD.md <<'MD'

The `CameraReachabilityMonitor` class in `Vyzio.Infrastructure/Services` polls every camera every
30 seconds, with a 2 second TCP timeout.
MD
