using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

public sealed class FrigateEventImageProvider(
    HttpClient httpClient, ILogger<FrigateEventImageProvider> logger) : IFrigateEventImageProvider
{
    public Task<Stream?> TryGetImageAsync(
        string frigateEventId,
        FrigateEventImage image,
        TimeSpan finalizationWindow = default,
        CancellationToken ct = default)
        => FrigateMediaFetch.TryReadAsync(
            httpClient,
            $"api/events/{frigateEventId}/{FileNameOf(image)}",
            image.ToString(),
            frigateEventId,
            finalizationWindow,
            logger,
            ct);

    private static string FileNameOf(FrigateEventImage image) => image switch
    {
        FrigateEventImage.Snapshot => "snapshot.jpg",
        FrigateEventImage.Thumbnail => "thumbnail.jpg",
        _ => throw new ArgumentOutOfRangeException(nameof(image))
    };
}
