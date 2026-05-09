using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Persistence;

namespace Vyzio.Tests;

public class VyzioDbContextTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly VyzioDbContext _db;

    public VyzioDbContextTests()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<VyzioDbContext>()
            .UseSqlite(_connection)
            .UseSnakeCaseNamingConvention()
            .Options;

        _db = new VyzioDbContext(options);
        _db.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public void Schema_creates_all_tables()
    {
        _db.Settings.Add(new Setting { Key = "test", Value = "ok" });
        _db.SaveChanges();
        Assert.Equal(1, _db.Settings.Count());
    }

    [Fact]
    public void Profile_can_be_created_and_retrieved()
    {
        var profile = new Profile { Name = "Alice", Category = "household", AlertMode = "notify" };
        _db.Profiles.Add(profile);
        _db.SaveChanges();

        var loaded = _db.Profiles.Single();
        Assert.Equal("Alice", loaded.Name);
        Assert.Equal("household", loaded.Category);
        Assert.NotEmpty(loaded.Id);
    }

    [Fact]
    public void RecognitionEvent_cascade_deletes_with_profile()
    {
        var profile = new Profile { Name = "Bob" };
        _db.Profiles.Add(profile);
        _db.SaveChanges();

        _db.RecognitionEvents.Add(new RecognitionEvent
        {
            FrigateEventId = "frigate-001",
            CameraName = "front_door",
            RecognitionType = "face_known",
            ProfileId = profile.Id
        });
        _db.SaveChanges();

        _db.Profiles.Remove(profile);
        _db.SaveChanges();

        Assert.Equal(0, _db.RecognitionEvents.Count());
    }

    [Fact]
    public void FrigateEventId_unique_index_prevents_duplicates()
    {
        _db.RecognitionEvents.Add(new RecognitionEvent
        {
            FrigateEventId = "dup-001",
            CameraName = "front_door",
            RecognitionType = "face_unknown"
        });
        _db.SaveChanges();

        _db.RecognitionEvents.Add(new RecognitionEvent
        {
            FrigateEventId = "dup-001",
            CameraName = "front_door",
            RecognitionType = "face_unknown"
        });

        Assert.Throws<DbUpdateException>(() => _db.SaveChanges());
    }
}
