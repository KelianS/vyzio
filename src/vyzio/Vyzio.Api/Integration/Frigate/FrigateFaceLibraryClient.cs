using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Vyzio.Core.Interfaces;

namespace Vyzio.Api.Integration.Frigate;

public sealed class FrigateFaceLibraryClient(HttpClient httpClient) : IFrigateFaceLibrary
{
    public async Task UploadFacePhotoAsync(string personName, string filename, byte[] imageJpeg, CancellationToken ct = default)
    {
        var escapedName = Uri.EscapeDataString(personName);

        // Create the person entry if it doesn't already exist
        var createResponse = await httpClient.PostAsync($"api/faces/{escapedName}/create", null, ct);
        if (!createResponse.IsSuccessStatusCode && createResponse.StatusCode != System.Net.HttpStatusCode.Conflict)
            createResponse.EnsureSuccessStatusCode();

        // Upload the face photo
        using var content = new MultipartFormDataContent();
        var imageContent = new ByteArrayContent(imageJpeg);
        imageContent.Headers.ContentType = System.Net.Http.Headers.MediaTypeHeaderValue.Parse("image/jpeg");
        content.Add(imageContent, "file", filename);
        var response = await httpClient.PostAsync($"api/faces/{escapedName}/register", content, ct);
        response.EnsureSuccessStatusCode();
    }

    public async Task DeleteFacePhotoAsync(string personName, string filename, CancellationToken ct = default)
    {
        var escapedName = Uri.EscapeDataString(personName);
        var response = await httpClient.PostAsJsonAsync(
            $"api/faces/{escapedName}/delete",
            new { fileName = filename },
            ct);

        // 404 is acceptable — photo may have already been removed from Frigate
        if (!response.IsSuccessStatusCode && response.StatusCode != System.Net.HttpStatusCode.NotFound)
            response.EnsureSuccessStatusCode();
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
