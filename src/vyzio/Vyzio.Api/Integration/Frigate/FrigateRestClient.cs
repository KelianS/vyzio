using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Vyzio.Api.Integration.Frigate;

public interface IFrigateRestClient
{
    Task<string?> TryGetIdentityAsync(string frigateEventId, CancellationToken ct = default);
}

public sealed class FrigateRestClient(HttpClient httpClient) : IFrigateRestClient
{
    public async Task<string?> TryGetIdentityAsync(string frigateEventId, CancellationToken ct = default)
    {
        var details = await httpClient.GetFromJsonAsync<FrigateEventDetailsDto>($"api/events/{frigateEventId}", ct);
        return ResolveSubLabel(details?.SubLabel);
    }

    private static string? ResolveSubLabel(JsonElement? subLabel)
    {
        if (subLabel is null)
        {
            return null;
        }

        return subLabel.Value.ValueKind switch
        {
            JsonValueKind.String => string.IsNullOrWhiteSpace(subLabel.Value.GetString()) ? null : subLabel.Value.GetString(),
            JsonValueKind.Array => subLabel.Value.EnumerateArray()
                .Where(entry => entry.ValueKind == JsonValueKind.String)
                .Select(entry => entry.GetString())
                .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)),
            _ => null
        };
    }

    private sealed class FrigateEventDetailsDto
    {
        [JsonPropertyName("sub_label")]
        public JsonElement? SubLabel { get; init; }
    }
}