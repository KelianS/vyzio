#!/usr/bin/env bash
# A new service logs a failed fetch at Error level without its exception, and returns a default.
set -euo pipefail
cat > src/vyzio/Vyzio.Infrastructure/Services/CameraSnapshotFetcher.cs <<'CS'
using Microsoft.Extensions.Logging;

namespace Vyzio.Infrastructure.Services;

public sealed class CameraSnapshotFetcher(HttpClient http, ILogger<CameraSnapshotFetcher> logger)
{
    public async Task<byte[]?> FetchAsync(Uri snapshotUrl, CancellationToken cancellationToken)
    {
        try
        {
            return await http.GetByteArrayAsync(snapshotUrl, cancellationToken);
        }
        catch (HttpRequestException)
        {
            logger.LogError("Snapshot fetch failed for {SnapshotUrl}", snapshotUrl);
            return null;
        }
    }
}
CS
