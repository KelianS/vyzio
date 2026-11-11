using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Persistence;
using Vyzio.Infrastructure.Persistence.Repositories;

namespace Vyzio.Tests.Persistence;

public sealed class NotificationRepositoryTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly VyzioDbContext _db;
    private readonly NotificationRepository _sut;

    public NotificationRepositoryTests()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<VyzioDbContext>()
            .UseSqlite(_connection).UseSnakeCaseNamingConvention().Options;
        _db = new VyzioDbContext(options);
        _db.Database.EnsureCreated();
        _sut = new NotificationRepository(_db);
    }

    public void Dispose() { _db.Dispose(); _connection.Dispose(); }

    private static Notification Row(string eventId, NotificationChannel channel) => new()
    {
        FrigateEventId = eventId,
        Channel = channel,
        Camera = "front_door",
        Label = "person",
        Status = NotificationStatus.Sent,
    };

    [Fact]
    public async Task DeleteForEventAsync_ShouldRemoveThatDetectionsRowsOnEveryChannelOnly_WhenOtherDetectionsHaveRows()
    {
        // Arrange
        await _sut.AddAsync(Row("evt-1", NotificationChannel.Telegram));
        await _sut.AddAsync(Row("evt-1", NotificationChannel.Discord));
        await _sut.AddAsync(Row("evt-2", NotificationChannel.Telegram));

        // Act
        var removed = await _sut.DeleteForEventAsync("evt-1");

        // Assert
        Assert.Equal(2, removed);
        Assert.Equal(["evt-2"], await _db.Notifications.Select(n => n.FrigateEventId).ToListAsync());
    }

    [Fact]
    public async Task GetLastSentAtForAsync_ShouldNoLongerCountADeletedDetection_WhenItWasTheLastNotified()
    {
        // Arrange
        await _sut.AddAsync(Row("evt-1", NotificationChannel.Telegram));
        await _sut.DeleteForEventAsync("evt-1");

        // Act
        var lastSentAt = await _sut.GetLastSentAtForAsync(NotificationChannel.Telegram, "front_door", "person");

        // Assert
        Assert.Null(lastSentAt);
    }
}
