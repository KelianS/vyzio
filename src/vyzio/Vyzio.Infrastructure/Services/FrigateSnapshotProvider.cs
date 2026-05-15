using Microsoft.Extensions.Logging;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

public sealed class FrigateSnapshotProvider(HttpClient httpClient, ILogger<FrigateSnapshotProvider> logger) : IFrigateSnapshotProvider
{
    public async Task<Stream?> TryGetSnapshotAsync(string frigateEventId, CancellationToken ct = default)
    {
        var url = $"api/events/{frigateEventId}/snapshot.jpg";
        try
        {
            logger.LogDebug("Fetching snapshot for event {EventId} from {BaseAddress}{Url}",
                frigateEventId, httpClient.BaseAddress, url);

            var response = await httpClient.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Snapshot fetch failed for event {EventId}: HTTP {StatusCode}",
                    frigateEventId, (int)response.StatusCode);
                return null;
            }

            var bytes = await response.Content.ReadAsByteArrayAsync(ct);
            if (bytes.Length == 0)
            {
                logger.LogWarning("Snapshot for event {EventId} returned empty body", frigateEventId);
                return null;
            }

            logger.LogDebug("Snapshot retrieved for event {EventId}: {Bytes} bytes", frigateEventId, bytes.Length);
            return new MemoryStream(bytes);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Snapshot fetch threw for event {EventId}", frigateEventId);
            return null;
        }
    }
}
