using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

public sealed class FrigateEventReader(HttpClient httpClient) : IFrigateEventReader
{
    public async Task<string?> TryGetIdentityAsync(string frigateEventId, CancellationToken ct = default)
    {
        var details = await httpClient.GetFromJsonAsync<FrigateEventDto>($"api/events/{frigateEventId}", ct);
        return ResolveSubLabel(details?.SubLabel);
    }

    public async Task<IReadOnlyList<FrigateDetection>> QueryAsync(
        FrigateDetectionQuery query,
        CancellationToken ct = default)
    {
        try
        {
            var events = await httpClient.GetFromJsonAsync<List<FrigateEventDto>>(BuildUrl(query), ct);
            return events?.Select(ToDetection).ToArray() ?? [];
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            throw new FrigateUnavailableException(ex);
        }
    }

    private static string BuildUrl(FrigateDetectionQuery query)
    {
        var parameters = new List<string>
        {
            $"limit={Math.Max(query.Limit, 1)}",
            // The inline thumbnail is a base64 blob Vyzio never renders; the snapshot route serves it.
            "include_thumbnails=0"
        };

        if (!string.IsNullOrWhiteSpace(query.Camera))
            parameters.Add($"cameras={Uri.EscapeDataString(query.Camera)}");

        if (!string.IsNullOrWhiteSpace(query.Label))
            parameters.Add($"labels={Uri.EscapeDataString(query.Label)}");

        if (!string.IsNullOrWhiteSpace(query.Identity))
            parameters.Add($"sub_labels={Uri.EscapeDataString(query.Identity)}");

        if (query.After.HasValue)
            parameters.Add($"after={ToUnixSeconds(query.After.Value)}");

        if (query.Before.HasValue)
            parameters.Add($"before={ToUnixSeconds(query.Before.Value)}");

        return $"api/events?{string.Join('&', parameters)}";
    }

    private static string ToUnixSeconds(DateTimeOffset moment)
        => (moment.ToUnixTimeMilliseconds() / 1000d).ToString("0.######", CultureInfo.InvariantCulture);

    private static FrigateDetection ToDetection(FrigateEventDto dto)
        => new(
            dto.Id,
            dto.Camera,
            dto.Label,
            ResolveSubLabel(dto.SubLabel),
            dto.TopScore ?? dto.Data?.TopScore,
            DateTimeOffset.FromUnixTimeMilliseconds((long)(dto.StartTime * 1000)),
            dto.HasClip,
            dto.HasSnapshot);

    // Frigate answers sub_label as a string on some versions and as an array on others.
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

    private sealed class FrigateEventDto
    {
        [JsonPropertyName("id")]
        public string Id { get; init; } = string.Empty;

        [JsonPropertyName("camera")]
        public string Camera { get; init; } = string.Empty;

        [JsonPropertyName("label")]
        public string Label { get; init; } = string.Empty;

        [JsonPropertyName("sub_label")]
        public JsonElement? SubLabel { get; init; }

        [JsonPropertyName("top_score")]
        public float? TopScore { get; init; }

        [JsonPropertyName("data")]
        public FrigateEventDataDto? Data { get; init; }

        [JsonPropertyName("start_time")]
        public double StartTime { get; init; }

        [JsonPropertyName("has_clip")]
        public bool HasClip { get; init; }

        [JsonPropertyName("has_snapshot")]
        public bool HasSnapshot { get; init; }
    }

    // Frigate 0.17 moved the score into `data`, keeping the top-level one for compatibility.
    private sealed class FrigateEventDataDto
    {
        [JsonPropertyName("top_score")]
        public float? TopScore { get; init; }
    }
}
