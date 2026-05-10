using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Persistence;

namespace Vyzio.Tests.Persistence;

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
    public void Schema_creates_retained_mvp_tables()
    {
        _db.Sessions.Add(new Session
        {
            UserId = "user-001",
            ExpiresAt = DateTimeOffset.UtcNow.AddHours(1)
        });
        _db.SaveChanges();

        Assert.Equal(1, _db.Sessions.Count());
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
    public void DetectionEvent_cascade_deletes_with_profile()
    {
        var profile = new Profile { Name = "Bob" };
        _db.Profiles.Add(profile);
        _db.SaveChanges();

        _db.DetectionEvents.Add(new DetectionEvent
        {
            FrigateEventId = "frigate-001",
            Lifecycle = "new",
            Camera = "front_door",
            Label = "person",
            ProfileId = profile.Id
        });
        _db.SaveChanges();

        _db.Profiles.Remove(profile);
        _db.SaveChanges();

        Assert.Equal(0, _db.DetectionEvents.Count());
    }

    [Fact]
    public void FrigateEventId_unique_index_prevents_duplicates()
    {
        _db.DetectionEvents.Add(new DetectionEvent
        {
            FrigateEventId = "dup-001",
            Lifecycle = "new",
            Camera = "front_door",
            Label = "dog"
        });
        _db.SaveChanges();

        _db.DetectionEvents.Add(new DetectionEvent
        {
            FrigateEventId = "dup-001",
            Lifecycle = "update",
            Camera = "front_door",
            Label = "dog"
        });

        Assert.Throws<DbUpdateException>(() => _db.SaveChanges());
    }
}