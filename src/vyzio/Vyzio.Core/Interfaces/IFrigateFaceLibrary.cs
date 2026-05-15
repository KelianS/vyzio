namespace Vyzio.Core.Interfaces;

public interface IFrigateFaceLibrary
{
    Task UploadFacePhotoAsync(string personName, string filename, byte[] imageJpeg, CancellationToken ct = default);
    Task DeleteFacePhotoAsync(string personName, string filename, CancellationToken ct = default);
    Task<IReadOnlyList<FrigateFaceLibraryEntry>> GetLibraryAsync(CancellationToken ct = default);
}

public sealed record FrigateFaceLibraryEntry(string PersonName, IReadOnlyList<string> Filenames);
