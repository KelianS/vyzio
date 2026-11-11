#!/usr/bin/env bash
# An endpoint answers a refusal with a hand-written body instead of the shared ProblemDetails.
set -euo pipefail
sed -i 's/ApiProblem.BadRequest("photo_missing", "No file provided.")/Results.BadRequest(new { error = "photo_missing", message = "No file provided." })/' \
  src/vyzio/Vyzio.Api/Endpoints/ProfilesEndpoints.cs
grep -q 'new { error = "photo_missing"' src/vyzio/Vyzio.Api/Endpoints/ProfilesEndpoints.cs
