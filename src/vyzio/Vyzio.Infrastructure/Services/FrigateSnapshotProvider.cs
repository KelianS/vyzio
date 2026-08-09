using Microsoft.Extensions.Logging;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

public sealed class FrigateSnapshotProvider(HttpClient httpClient, ILogger<FrigateSnapshotProvider> logger) : IFrigateSnapshotProvider
{
    public Task<Stream?> TryGetSnapshotAsync(
        string frigateEventId, TimeSpan finalizationWindow = default, CancellationToken ct = default)
        => FrigateMediaFetch.TryReadAsync(
            httpClient,
            $"api/events/{frigateEventId}/snapshot.jpg",
            "Snapshot",
            frigateEventId,
            finalizationWindow,
            logger,
            ct);
}
