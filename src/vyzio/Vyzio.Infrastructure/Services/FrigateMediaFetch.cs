using System.Net;
using Microsoft.Extensions.Logging;

namespace Vyzio.Infrastructure.Services;

/// <summary>
/// Reads an event media from Frigate, retrying while the file is not written yet (ADR-49).
/// </summary>
internal static class FrigateMediaFetch
{
    private static readonly TimeSpan DefaultRetryInterval = TimeSpan.FromSeconds(2);

    public static async Task<Stream?> TryReadAsync(
        HttpClient httpClient,
        string url,
        string media,
        string frigateEventId,
        TimeSpan finalizationWindow,
        ILogger logger,
        CancellationToken ct,
        TimeSpan? retryInterval = null)
    {
        var interval = retryInterval ?? DefaultRetryInterval;
        var deadline = DateTimeOffset.UtcNow + finalizationWindow;
        var attempts = 0;

        while (true)
        {
            attempts++;
            var (stream, pending) = await ReadOnceAsync(httpClient, url, media, frigateEventId, logger, ct);

            if (stream is not null || !pending)
            {
                return stream;
            }

            var remaining = deadline - DateTimeOffset.UtcNow;
            if (remaining <= TimeSpan.Zero)
            {
                logger.LogWarning("{Media} still unavailable for event {EventId} after {Attempts} attempt(s)",
                    media, frigateEventId, attempts);
                return null;
            }

            await Task.Delay(remaining < interval ? remaining : interval, ct);
        }
    }

    // Second element tells whether the media may simply not exist yet, which is what makes a retry worth it.
    private static async Task<(Stream? Stream, bool Pending)> ReadOnceAsync(
        HttpClient httpClient, string url, string media, string frigateEventId, ILogger logger, CancellationToken ct)
    {
        try
        {
            logger.LogDebug("Fetching {Media} for event {EventId} from {BaseAddress}{Url}",
                media, frigateEventId, httpClient.BaseAddress, url);

            var response = await httpClient.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("{Media} fetch failed for event {EventId}: HTTP {StatusCode}",
                    media, frigateEventId, (int)response.StatusCode);
                return (null, response.StatusCode == HttpStatusCode.NotFound);
            }

            var bytes = await response.Content.ReadAsByteArrayAsync(ct);
            if (bytes.Length == 0)
            {
                logger.LogWarning("{Media} for event {EventId} returned empty body", media, frigateEventId);
                return (null, true);
            }

            logger.LogDebug("{Media} retrieved for event {EventId}: {Bytes} bytes", media, frigateEventId, bytes.Length);
            return (new MemoryStream(bytes), false);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "{Media} fetch threw for event {EventId}", media, frigateEventId);
            return (null, true);
        }
    }
}
