#!/bin/sh
set -e
if [ -S /var/run/docker.sock ]; then
    GID=$(stat -c '%g' /var/run/docker.sock)
    getent group "$GID" >/dev/null 2>&1 || addgroup -g "$GID" dockerhost
    adduser vyzio "$(getent group "$GID" | cut -d: -f1)" 2>/dev/null || true
fi
# Host folders arrive root-owned, and vyzio cannot reclaim them once root is dropped; frigate runs as root.
chown -R vyzio:vyzio /config /app/data
exec su-exec vyzio dotnet Vyzio.Api.dll
