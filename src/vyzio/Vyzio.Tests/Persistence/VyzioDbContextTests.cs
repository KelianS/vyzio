using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Persistence;
using Vyzio.Infrastructure.Persistence.Repositories;

namespace Vyzio.Tests.Persistence;

public sealed class VyzioDbContextTests : IDisposable
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
    public void Deleting_an_account_closes_the_sessions_it_opened()
    {
        var account = new Account { PasswordHash = "hash" };
        _db.Accounts.Add(account);
        _db.Sessions.Add(Session.Open(account.Id, "token-hash", "Firefox", DateTimeOffset.UtcNow));
        _db.SaveChanges();

        _db.Accounts.Remove(account);
        _db.SaveChanges();

        Assert.Empty(_db.Sessions);
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
    public void SaveChanges_ShouldStoreTheValidationStateAsItsText_WhenACameraIsSaved()
    {
        _db.Cameras.Add(new Camera
        {
            Slug = "garage",
            DisplayName = "Garage",
            Host = "192.168.1.20",
            FrigateCameraName = "garage",
            ValidationState = CameraValidationState.PendingRemoval,
        });
        _db.SaveChanges();
        _db.ChangeTracker.Clear();

        Assert.Equal("pending_removal", _db.Database.SqlQueryRaw<string>("SELECT validation_state AS Value FROM cameras").Single());
        Assert.Equal(CameraValidationState.PendingRemoval, _db.Cameras.Single().ValidationState);
    }
}
