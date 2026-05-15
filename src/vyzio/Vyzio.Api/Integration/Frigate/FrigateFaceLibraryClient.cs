using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Vyzio.Core.Interfaces;

namespace Vyzio.Api.Integration.Frigate;

public sealed class FrigateFaceLibraryClient(HttpClient httpClient) : IFrigateFaceLibrary
{
    public async Task UploadFacePhotoAsync(string personName, string filename, byte[] imageJpeg, CancellationToken ct = default)
    {
        using var content = new MultipartFormDataContent();
        content.Add(new ByteArrayContent(imageJpeg), "file", filename);
        var response = await httpClient.PostAsync($"api/faces/{Uri.EscapeDataString(personName)}", content, ct);
        response.EnsureSuccessStatusCode();
    }

    public async Task DeleteFacePhotoAsync(string personName, string filename, CancellationToken ct = default)
    {
        var response = await httpClient.DeleteAsync(
            $"api/faces/{Uri.EscapeDataString(personName)}/{Uri.EscapeDataString(filename)}", ct);

        // 404 is acceptable — photo may have already been removed from Frigate
        if (!response.IsSuccessStatusCode && response.StatusCode != System.Net.HttpStatusCode.NotFound)
        {
            response.EnsureSuccessStatusCode();
        }
    }

    public async Task<IReadOnlyList<FrigateFaceLibraryEntry>> GetLibraryAsync(CancellationToken ct = default)
    {
        var result = await httpClient.GetFromJsonAsync<Dictionary<string, List<string>>>("api/faces", ct);
        if (result is null)
            return [];

        return result
            .Select(kv => new FrigateFaceLibraryEntry(kv.Key, kv.Value))
            .ToList();
    }
}
