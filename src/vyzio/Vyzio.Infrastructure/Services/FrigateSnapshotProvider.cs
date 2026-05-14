using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

public sealed class FrigateSnapshotProvider(HttpClient httpClient) : IFrigateSnapshotProvider
{
    public async Task<Stream?> TryGetSnapshotAsync(string frigateEventId, CancellationToken ct = default)
    {
        try
        {
            var response = await httpClient.GetAsync(
                $"api/events/{frigateEventId}/snapshot.jpg",
                HttpCompletionOption.ResponseHeadersRead,
                ct);

            if (!response.IsSuccessStatusCode)
                return null;

            var bytes = await response.Content.ReadAsByteArrayAsync(ct);
            return bytes.Length > 0 ? new MemoryStream(bytes) : null;
        }
        catch
        {
            return null;
        }
    }
}
