using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Vyzio.Infrastructure.Persistence;

namespace Vyzio.Tests.Persistence;

public sealed class DatabaseMigrationTests : IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly VyzioDbContext _db;
    private readonly LogLines _log = new();

    public DatabaseMigrationTests()
    {
        _connection.Open();
        _db = new VyzioDbContext(new DbContextOptionsBuilder<VyzioDbContext>()
            .UseSqlite(_connection)
            .UseSnakeCaseNamingConvention()
            .Options);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task ApplyAsync_ShouldLogTheMigrationsItApplied_WhenTheDatabaseIsNew()
    {
        // Act
        var applied = await DatabaseMigration.ApplyAsync(_db, _log);

        // Assert
        Assert.Contains("20260831213210_InitialSchema", applied);
        var (level, message) = Assert.Single(_log.Lines);
        Assert.Equal(LogLevel.Information, level);
        Assert.Contains("20260831213210_InitialSchema", message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ApplyAsync_ShouldSayTheSchemaIsUpToDate_WhenNoMigrationIsPending()
    {
        // Arrange
        await DatabaseMigration.ApplyAsync(_db, new LogLines());

        // Act
        var applied = await DatabaseMigration.ApplyAsync(_db, _log);

        // Assert
        Assert.Empty(applied);
        var (level, message) = Assert.Single(_log.Lines);
        Assert.Equal(LogLevel.Information, level);
        Assert.Equal("Database schema is up to date, no migration applied", message);
    }

    private sealed class LogLines : ILogger
    {
        public List<(LogLevel Level, string Message)> Lines { get; } = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId,
            TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
            Lines.Add((logLevel, formatter(state, exception)));
    }
}
