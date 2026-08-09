using Microsoft.Extensions.Logging;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

public sealed class FrigateClipProvider(HttpClient httpClient, ILogger<FrigateClipProvider> logger) : IFrigateClipProvider
{
    public Task<Stream?> TryGetClipAsync(
        string frigateEventId, TimeSpan finalizationWindow = default, CancellationToken ct = default)
        => FrigateMediaFetch.TryReadAsync(
            httpClient,
            $"api/events/{frigateEventId}/clip.mp4",
            "Clip",
            frigateEventId,
            finalizationWindow,
            logger,
            ct);
}
