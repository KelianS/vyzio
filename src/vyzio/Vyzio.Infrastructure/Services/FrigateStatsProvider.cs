using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

public sealed class FrigateStatsProvider(HttpClient httpClient, ILogger<FrigateStatsProvider> logger) : IFrigateStatsProvider
{
    public async Task<FrigateStats?> TryGetStatsAsync(CancellationToken ct = default)
    {
        try
        {
            var raw = await httpClient.GetFromJsonAsync<FrigateStatsDto>("api/stats", ct);
            if (raw is null) return null;

            var storage = ParseStorage(raw.Service?.Storage);

            var cameras = raw.Cameras?
                .Select(kv => new CameraFps(kv.Key, kv.Value.CameraFps))
                .ToList() ?? [];

            return new FrigateStats(storage, cameras);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to fetch Frigate stats");
            return null;
        }
    }

    private static StorageStats? ParseStorage(Dictionary<string, FrigateStorageEntryDto>? storageMap)
    {
        if (storageMap is null || storageMap.Count == 0) return null;

        // Use the first storage entry (typically /media/frigate). Frigate reports in MB.
        var entry = storageMap.Values.First();
        const double mbPerGb = 1024.0;
        return new StorageStats(
            TotalGb: Math.Round(entry.Total / mbPerGb, 1),
            UsedGb: Math.Round(entry.Used / mbPerGb, 1),
            FreeGb: Math.Round(entry.Free / mbPerGb, 1)
        );
    }

    // Frigate /api/stats response shape (only the fields we care about)
    private sealed class FrigateStatsDto
    {
        [JsonPropertyName("service")]
        public FrigateServiceDto? Service { get; init; }

        [JsonPropertyName("cameras")]
        public Dictionary<string, FrigateCameraStatsDto>? Cameras { get; init; }
    }

    private sealed class FrigateServiceDto
    {
        [JsonPropertyName("storage")]
        public Dictionary<string, FrigateStorageEntryDto>? Storage { get; init; }
    }

    private sealed class FrigateStorageEntryDto
    {
        [JsonPropertyName("total")]
        public double Total { get; init; }

        [JsonPropertyName("used")]
        public double Used { get; init; }

        [JsonPropertyName("free")]
        public double Free { get; init; }
    }

    private sealed class FrigateCameraStatsDto
    {
        [JsonPropertyName("camera_fps")]
        public double CameraFps { get; init; }
    }
}
