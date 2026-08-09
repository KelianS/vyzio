using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Persistence;
using Vyzio.Infrastructure.Persistence.Repositories;

namespace Vyzio.Tests.Persistence;

public class ProfilePhotoRepositoryTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly VyzioDbContext _db;
    private readonly ProfilePhotoRepository _sut;

    public ProfilePhotoRepositoryTests()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<VyzioDbContext>()
            .UseSqlite(_connection).UseSnakeCaseNamingConvention().Options;
        _db = new VyzioDbContext(options);
        _db.Database.EnsureCreated();
        _sut = new ProfilePhotoRepository(_db);
    }

    public void Dispose() { _db.Dispose(); _connection.Dispose(); }

    [Fact]
    public async Task AddAsync_and_GetByProfileIdAsync_roundtrip()
    {
        var profile = new Profile { Name = "Alice" };
        _db.Profiles.Add(profile);
        await _db.SaveChangesAsync();

        var photo = new ProfilePhoto { ProfileId = profile.Id, Filename = "alice1.jpg" };
        await _sut.AddAsync(photo);

        var list = await _sut.GetByProfileIdAsync(profile.Id);

        Assert.Single(list);
        Assert.Equal("alice1.jpg", list[0].Filename);
    }

    [Fact]
    public async Task GetUnsyncedAsync_returns_only_unsynced()
    {
        var profile = new Profile { Name = "Bob" };
        _db.Profiles.Add(profile);
        await _db.SaveChangesAsync();

        await _sut.AddAsync(new ProfilePhoto { ProfileId = profile.Id, Filename = "synced.jpg", FrigateSynced = true });
        await _sut.AddAsync(new ProfilePhoto { ProfileId = profile.Id, Filename = "unsynced.jpg", FrigateSynced = false });

        var unsynced = await _sut.GetUnsyncedAsync();

        Assert.Single(unsynced);
        Assert.Equal("unsynced.jpg", unsynced[0].Filename);
    }

    [Fact]
    public async Task DeleteAsync_removes_photo()
    {
        var profile = new Profile { Name = "Carol" };
        _db.Profiles.Add(profile);
        await _db.SaveChangesAsync();

        var photo = new ProfilePhoto { ProfileId = profile.Id, Filename = "photo.jpg" };
        await _sut.AddAsync(photo);

        await _sut.DeleteAsync(photo.Id);

        var remaining = await _sut.GetByProfileIdAsync(profile.Id);
        Assert.Empty(remaining);
    }

    [Fact]
    public async Task UpdateAsync_persists_sync_status()
    {
        var profile = new Profile { Name = "Dave" };
        _db.Profiles.Add(profile);
        await _db.SaveChangesAsync();

        var photo = new ProfilePhoto { ProfileId = profile.Id, Filename = "photo.jpg" };
        await _sut.AddAsync(photo);

        photo.FrigateSynced = true;
        photo.SyncedAt = DateTimeOffset.UtcNow;
        await _sut.UpdateAsync(photo);

        var loaded = await _sut.GetByIdAsync(photo.Id);
        Assert.NotNull(loaded);
        Assert.True(loaded.FrigateSynced);
    }
}

public class ProfileCameraLinkRepositoryTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly VyzioDbContext _db;
    private readonly ProfileCameraLinkRepository _sut;

    public ProfileCameraLinkRepositoryTests()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<VyzioDbContext>()
            .UseSqlite(_connection).UseSnakeCaseNamingConvention().Options;
        _db = new VyzioDbContext(options);
        _db.Database.EnsureCreated();
        _sut = new ProfileCameraLinkRepository(_db);
    }

    public void Dispose() { _db.Dispose(); _connection.Dispose(); }

    private async Task<(Profile, Camera)> SeedProfileAndCameraAsync(string profileName = "Alice", string cameraName = "front_door")
    {
        var profile = new Profile { Name = profileName };
        var camera = new Camera
        {
            Slug = cameraName,
            DisplayName = cameraName,
            SourceType = "rtsp",
            Host = "192.168.1.1",
        };
        _db.Profiles.Add(profile);
        _db.Cameras.Add(camera);
        await _db.SaveChangesAsync();
        return (profile, camera);
    }

    [Fact]
    public async Task UpsertAsync_creates_link_when_none_exists()
    {
        var (profile, camera) = await SeedProfileAndCameraAsync();

        await _sut.UpsertAsync(new ProfileCameraLink
        {
            ProfileId = profile.Id,
            CameraId = camera.Id,
            Enabled = true,
        });

        var links = await _sut.GetByProfileIdAsync(profile.Id);
        Assert.Single(links);
        Assert.True(links[0].Enabled);
    }

    [Fact]
    public async Task UpsertAsync_updates_enabled_when_link_already_exists()
    {
        var (profile, camera) = await SeedProfileAndCameraAsync();

        await _sut.UpsertAsync(new ProfileCameraLink { ProfileId = profile.Id, CameraId = camera.Id, Enabled = true });
        await _sut.UpsertAsync(new ProfileCameraLink { ProfileId = profile.Id, CameraId = camera.Id, Enabled = false });

        var links = await _sut.GetByProfileIdAsync(profile.Id);
        Assert.Single(links);
        Assert.False(links[0].Enabled);
    }

    [Fact]
    public async Task UpsertAsync_enforces_unique_profile_camera_pair()
    {
        var (profile, camera) = await SeedProfileAndCameraAsync();

        await _sut.UpsertAsync(new ProfileCameraLink { ProfileId = profile.Id, CameraId = camera.Id, Enabled = true });
        await _sut.UpsertAsync(new ProfileCameraLink { ProfileId = profile.Id, CameraId = camera.Id, Enabled = true });

        var links = await _sut.GetByProfileIdAsync(profile.Id);
        Assert.Single(links);
    }

    [Fact]
    public async Task DeleteByProfileAndCameraAsync_removes_link()
    {
        var (profile, camera) = await SeedProfileAndCameraAsync();
        await _sut.UpsertAsync(new ProfileCameraLink { ProfileId = profile.Id, CameraId = camera.Id, Enabled = true });

        await _sut.DeleteByProfileAndCameraAsync(profile.Id, camera.Id);

        var links = await _sut.GetByProfileIdAsync(profile.Id);
        Assert.Empty(links);
    }

    [Fact]
    public async Task GetByCameraIdAsync_returns_links_for_camera()
    {
        var (profile1, camera) = await SeedProfileAndCameraAsync("Alice", "cam-1");
        var profile2 = new Profile { Name = "Bob" };
        _db.Profiles.Add(profile2);
        await _db.SaveChangesAsync();

        await _sut.UpsertAsync(new ProfileCameraLink { ProfileId = profile1.Id, CameraId = camera.Id, Enabled = true });
        await _sut.UpsertAsync(new ProfileCameraLink { ProfileId = profile2.Id, CameraId = camera.Id, Enabled = true });

        var links = await _sut.GetByCameraIdAsync(camera.Id);
        Assert.Equal(2, links.Count);
    }
}

public class DetectionEventRepositoryIdentityTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly VyzioDbContext _db;
    private readonly DetectionEventRepository _sut;

    public DetectionEventRepositoryIdentityTests()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<VyzioDbContext>()
            .UseSqlite(_connection).UseSnakeCaseNamingConvention().Options;
        _db = new VyzioDbContext(options);
        _db.Database.EnsureCreated();
        _sut = new DetectionEventRepository(_db);
    }

    public void Dispose() { _db.Dispose(); _connection.Dispose(); }

    [Fact]
    public async Task UpdateIdentityAsync_sets_identity_and_profileId()
    {
        // Seed a real profile so FK is satisfied
        var profile = new Profile { Name = "Alice" };
        _db.Profiles.Add(profile);
        _db.DetectionEvents.Add(new DetectionEvent
        {
            FrigateEventId = "identity-test",
            Lifecycle = "end",
            Camera = "cam",
            Label = "person",
        });
        await _db.SaveChangesAsync();

        var evt = await _sut.GetByFrigateEventIdAsync("identity-test");
        Assert.NotNull(evt);

        await _sut.UpdateIdentityAsync(evt.Id, "Alice", profile.Id);

        _db.ChangeTracker.Clear();
        var updated = await _db.DetectionEvents.FirstOrDefaultAsync(e => e.Id == evt.Id);
        Assert.NotNull(updated);
        Assert.Equal("Alice", updated.Identity);
        Assert.Equal(profile.Id, updated.ProfileId);
    }

    [Fact]
    public async Task UpdateIdentityAsync_clears_identity_when_null()
    {
        // Seed a real profile so FK is satisfied on initial insert
        var profile = new Profile { Name = "Bob" };
        _db.Profiles.Add(profile);
        var evt = new DetectionEvent
        {
            FrigateEventId = "clear-test",
            Lifecycle = "end",
            Camera = "cam",
            Label = "person",
            Identity = "Bob",
            ProfileId = profile.Id,
        };
        _db.DetectionEvents.Add(evt);
        await _db.SaveChangesAsync();

        await _sut.UpdateIdentityAsync(evt.Id, null, null);

        _db.ChangeTracker.Clear();
        var updated = await _db.DetectionEvents.FirstOrDefaultAsync(e => e.Id == evt.Id);
        Assert.NotNull(updated);
        Assert.Null(updated.Identity);
        Assert.Null(updated.ProfileId);
    }
}
