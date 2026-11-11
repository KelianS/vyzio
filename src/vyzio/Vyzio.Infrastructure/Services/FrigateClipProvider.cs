using System.Net;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

public sealed class FrigateClipProvider(
    HttpClient httpClient, TimeProvider time, ILogger<FrigateClipProvider> logger) : IFrigateClipProvider
{
    public Task<Stream?> TryGetClipAsync(
        string frigateEventId, TimeSpan finalizationWindow = default, CancellationToken ct = default)
        => FrigateMediaFetch.TryReadAsync(
            httpClient,
            $"api/events/{frigateEventId}/clip.mp4",
            "Clip",
            frigateEventId,
            finalizationWindow,
            time,
            logger,
            ct);

    public async Task<Stream?> ReadClipAsync(string frigateEventId, CancellationToken ct = default)
    {
        var url = $"api/events/{Uri.EscapeDataString(frigateEventId)}/clip.mp4";
        HttpResponseMessage response;
        try
        {
            response = await httpClient.GetAsync(url, ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            throw Unreadable($"GET {url} got no answer: {ex.Message}", ex);
        }

        using (response)
        {
            // Frigate says "no clip" with a 404 (no event, no clip) or a 400 (no recording left for its time range).
            if (response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.BadRequest)
                return null;

            if (!response.IsSuccessStatusCode)
                throw Unreadable($"GET {url} answered {(int)response.StatusCode} {response.ReasonPhrase}");

            var bytes = await response.Content.ReadAsByteArrayAsync(ct);
            if (bytes.Length == 0)
                throw Unreadable($"GET {url} answered an empty body");

            return new MemoryStream(bytes);
        }
    }

    private FrigateClipUnreadableException Unreadable(string detail, Exception? inner = null)
    {
        var failure = new FrigateClipUnreadableException(detail, inner);
        // The detail carries the id from the route: no line break of it reaches the log (cs/log-forging).
        logger.LogError(failure, "Reading a clip failed: {Detail}",
            detail.Replace("\r", string.Empty).Replace("\n", string.Empty));
        return failure;
    }
}
