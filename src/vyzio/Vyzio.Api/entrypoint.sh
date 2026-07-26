#!/bin/sh
set -e
if [ -S /var/run/docker.sock ]; then
    GID=$(stat -c '%g' /var/run/docker.sock)
    getent group "$GID" >/dev/null 2>&1 || addgroup -g "$GID" dockerhost
    adduser vyzio "$(getent group "$GID" | cut -d: -f1)" 2>/dev/null || true
fi
# /config is a volume shared with frigate (root, starts first per depends_on). On a fresh volume,
# Docker seeds it from frigate's own image content, leaving it root-owned — vyzio (non-root) can then
# never chmod/chown paths under it itself. Reclaim it here while still root; frigate keeps full access
# regardless of ownership since it always runs as root.
chown -R vyzio:vyzio /config
exec su-exec vyzio dotnet Vyzio.Api.dll
