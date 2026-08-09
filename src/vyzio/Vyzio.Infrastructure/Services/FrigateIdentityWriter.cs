using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

public sealed class FrigateIdentityWriter(HttpClient httpClient, ILogger<FrigateIdentityWriter> logger)
    : IFrigateIdentityWriter
{
    public async Task<bool> TrySetIdentityAsync(string frigateEventId, string? identity, CancellationToken ct = default)
    {
        try
        {
            // An empty name is how Frigate clears the label; null is rejected outright.
            var response = await httpClient.PostAsJsonAsync(
                $"api/events/{frigateEventId}/sub_label",
                new SubLabelRequest(identity ?? string.Empty, Score: 1f),
                ct);

            if (response.IsSuccessStatusCode)
                return true;

            logger.LogWarning("Identity correction refused for event {EventId}: HTTP {StatusCode}",
                frigateEventId, (int)response.StatusCode);
            return false;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Identity correction threw for event {EventId}", frigateEventId);
            return false;
        }
    }

    // A correction is a human assertion, not a guess: it carries full confidence.
    private sealed record SubLabelRequest(
        [property: JsonPropertyName("subLabel")] string SubLabel,
        [property: JsonPropertyName("subLabelScore")] float Score);
}
