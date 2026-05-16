using Microsoft.Extensions.Logging;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

public sealed class FrigateClipProvider(HttpClient httpClient, ILogger<FrigateClipProvider> logger) : IFrigateClipProvider
{
    public async Task<Stream?> TryGetClipAsync(string frigateEventId, CancellationToken ct = default)
    {
        var url = $"api/events/{frigateEventId}/clip.mp4";
        try
        {
            logger.LogDebug("Fetching clip for event {EventId} from {BaseAddress}{Url}",
                frigateEventId, httpClient.BaseAddress, url);

            var response = await httpClient.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Clip fetch failed for event {EventId}: HTTP {StatusCode}",
                    frigateEventId, (int)response.StatusCode);
                return null;
            }

            var bytes = await response.Content.ReadAsByteArrayAsync(ct);
            if (bytes.Length == 0)
            {
                logger.LogWarning("Clip for event {EventId} returned empty body", frigateEventId);
                return null;
            }

            logger.LogDebug("Clip retrieved for event {EventId}: {Bytes} bytes", frigateEventId, bytes.Length);
            return new MemoryStream(bytes);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Clip fetch threw for event {EventId}", frigateEventId);
            return null;
        }
    }
}
