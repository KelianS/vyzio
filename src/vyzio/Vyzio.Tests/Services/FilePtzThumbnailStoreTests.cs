using Vyzio.Infrastructure.Services;

namespace Vyzio.Tests.Services;

// The thumbnails Vyzio keeps of each slot, as files beside the database (ADR-69 c).
public sealed class FilePtzThumbnailStoreTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), $"vyzio-thumbnails-{Guid.NewGuid():N}");

    public void Dispose() => Directory.Delete(_directory, recursive: true);

    [Fact]
    public async Task ExistsAsync_ShouldSayATakenThumbnailExists_WhenOneWasSavedForTheSlot()
    {
        // Arrange
        var store = new FilePtzThumbnailStore(_directory);
        await store.SaveAsync("cam1", 2, [0xFF, 0xD8]);

        // Act
        var exists = await store.ExistsAsync("cam1", 2);

        // Assert
        Assert.True(exists);
        Assert.False(await store.ExistsAsync("cam1", 3));
    }

    [Fact]
    public async Task DeleteAsync_ShouldDropTheSlotsThumbnail_WhenOneWasSaved()
    {
        // Arrange
        var store = new FilePtzThumbnailStore(_directory);
        await store.SaveAsync("cam1", 2, [0xFF, 0xD8]);

        // Act
        await store.DeleteAsync("cam1", 2);

        // Assert
        Assert.False(await store.ExistsAsync("cam1", 2));
    }

    [Fact]
    public async Task DeleteAsync_ShouldDoNothing_WhenTheSlotHasNoThumbnail()
    {
        // Arrange
        var store = new FilePtzThumbnailStore(_directory);

        // Act
        var error = await Record.ExceptionAsync(() => store.DeleteAsync("cam1", 4));

        // Assert
        Assert.Null(error);
    }
}
