using Microsoft.Extensions.Logging;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

public sealed class FrigateLiveFrameProvider(HttpClient httpClient, ILogger<FrigateLiveFrameProvider> logger) : IFrigateLiveFrameProvider
{
    public async Task<byte[]?> TryGetLatestFrameAsync(string frigateCameraName, CancellationToken ct = default)
    {
        var url = $"api/{frigateCameraName}/latest.jpg";
        try
        {
            var response = await httpClient.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Latest frame fetch failed for camera {Camera}: HTTP {StatusCode}",
                    frigateCameraName, (int)response.StatusCode);
                return null;
            }

            var bytes = await response.Content.ReadAsByteArrayAsync(ct);
            return bytes.Length == 0 ? null : bytes;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Latest frame fetch threw for camera {Camera}", frigateCameraName);
            return null;
        }
    }
}
