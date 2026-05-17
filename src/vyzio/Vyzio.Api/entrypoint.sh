#!/bin/sh
set -e
if [ -S /var/run/docker.sock ]; then
    GID=$(stat -c '%g' /var/run/docker.sock)
    getent group "$GID" >/dev/null 2>&1 || addgroup -g "$GID" dockerhost
    adduser vyzio "$(getent group "$GID" | cut -d: -f1)" 2>/dev/null || true
fi
exec su-exec vyzio dotnet Vyzio.Api.dll
