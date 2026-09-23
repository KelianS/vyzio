using System.Net;
using System.Text.Json;
using EFCore.NamingConventions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using NSubstitute;
using Vyzio.Api.Integration.Frigate;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Configuration;
using Vyzio.Infrastructure.Persistence;

namespace Vyzio.Tests.Integration;

public sealed class HealthEndpointsTests : IClassFixture<HealthApiFactory>
{
    private static readonly FrigateStats Running = new(null, []);
    private static readonly string[] StatusWords = ["healthy", "degraded", "unhealthy"];

    private readonly HealthApiFactory _factory;

    public HealthEndpointsTests(HealthApiFactory factory)
    {
        _factory = factory;
        _factory.Stats.ClearReceivedCalls();
        _factory.Stats.TryGetStatsAsync(Arg.Any<CancellationToken>()).Returns(Running);
        _factory.Restarts.IsRestarting.Returns(false);
        _factory.Mqtt.Subscribed();
    }

    private static async Task<(HttpStatusCode Status, JsonElement Body)> GetAsync(HealthApiFactory factory, string path)
    {
        using var client = factory.CreateClient();
        using var response = await client.GetAsync(path);
        var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();
        return (response.StatusCode, body);
    }

    private static string Check(JsonElement body, string name) => body.GetProperty("checks").GetProperty(name).GetString()!;

    [Fact]
    public async Task GetHealth_ShouldAnswerHealthy_WhenOnlyTheProcessIsUp()
    {
        // Arrange
        _factory.Mqtt.Lost();
        _factory.Stats.TryGetStatsAsync(Arg.Any<CancellationToken>()).Returns((FrigateStats?)null);

        // Act
        var (status, body) = await GetAsync(_factory, "/health");

        // Assert
        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal("healthy", body.GetProperty("status").GetString());
    }

    [Fact]
    public async Task GetReadiness_ShouldAnswerHealthy_WhenEveryDependencyAnswers()
    {
        // Act
        var (status, body) = await GetAsync(_factory, "/health/ready");

        // Assert
        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal("healthy", body.GetProperty("status").GetString());
        Assert.Equal("healthy", Check(body, "database"));
        Assert.Equal("healthy", Check(body, "mqtt"));
        Assert.Equal("healthy", Check(body, "frigate"));
    }

    [Fact]
    public async Task GetReadiness_ShouldAnswerUnavailable_WhenTheBrokerIsLost()
    {
        // Arrange
        _factory.Mqtt.Lost();

        // Act
        var (status, body) = await GetAsync(_factory, "/health/ready");

        // Assert
        Assert.Equal(HttpStatusCode.ServiceUnavailable, status);
        Assert.Equal("unhealthy", Check(body, "mqtt"));
    }

    [Fact]
    public async Task GetReadiness_ShouldAnswerUnavailable_WhenFrigateStopsAnswering()
    {
        // Arrange
        _factory.Stats.TryGetStatsAsync(Arg.Any<CancellationToken>()).Returns((FrigateStats?)null);

        // Act
        var (status, body) = await GetAsync(_factory, "/health/ready");

        // Assert
        Assert.Equal(HttpStatusCode.ServiceUnavailable, status);
        Assert.Equal("unhealthy", Check(body, "frigate"));
    }

    [Fact]
    public async Task GetReadiness_ShouldAnswerDegraded_WhenFrigateRestartsAfterASettingChange()
    {
        // Arrange
        _factory.Stats.TryGetStatsAsync(Arg.Any<CancellationToken>()).Returns((FrigateStats?)null);
        _factory.Restarts.IsRestarting.Returns(true);

        // Act
        var (status, body) = await GetAsync(_factory, "/health/ready");

        // Assert
        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal("degraded", body.GetProperty("status").GetString());
        Assert.Equal("degraded", Check(body, "frigate"));
    }

    [Fact]
    public async Task GetReadiness_ShouldAnswerUnavailable_WhenTheDatabaseCannotBeOpened()
    {
        // Arrange
        using var factory = new HealthApiFactory
        {
            DatabaseFile = Path.Combine(Path.GetTempPath(), $"vyzio-health-{Guid.NewGuid():N}.db"),
        };
        factory.Stats.TryGetStatsAsync(Arg.Any<CancellationToken>()).Returns(Running);
        factory.Mqtt.Subscribed();
        _ = factory.Services;
        File.Delete(factory.DatabaseFile!);

        // Act
        var (status, body) = await GetAsync(factory, "/health/ready");

        // Assert
        Assert.Equal(HttpStatusCode.ServiceUnavailable, status);
        Assert.Equal("unhealthy", Check(body, "database"));
    }

    [Fact]
    public async Task GetReadiness_ShouldSayNothingButStatuses_WhenAStrangerAsks()
    {
        // Arrange
        _factory.Mqtt.Lost();

        // Act
        var (_, body) = await GetAsync(_factory, "/health/ready");

        // Assert
        Assert.Equal(["status", "checks"], body.EnumerateObject().Select(property => property.Name));
        Assert.All(
            body.GetProperty("checks").EnumerateObject(),
            check => Assert.Contains(check.Value.GetString(), StatusWords));
    }
}

public sealed class HealthApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");

    // Opened without create mode or pooling, so deleting it takes the database away from a running API.
    public string? DatabaseFile { get; init; }

    public IFrigateStatsProvider Stats { get; } = Substitute.For<IFrigateStatsProvider>();

    public IFrigateRestartTracker Restarts { get; } = Substitute.For<IFrigateRestartTracker>();

    public FrigateMqttConnection Mqtt => Services.GetRequiredService<FrigateMqttConnection>();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IHostedService>();
            services.RemoveAll<DbContextOptions<VyzioDbContext>>();
            services.RemoveAll<VyzioDbContext>();
            services.RemoveAll<VyzioRuntimeSettings>();
            services.RemoveAll<IFrigateStatsProvider>();
            services.RemoveAll<IFrigateRestartTracker>();
            services.AddSingleton(new VyzioRuntimeSettings());
            services.AddSingleton(Stats);
            services.AddSingleton(Restarts);

            if (DatabaseFile is null)
            {
                _connection.Open();
                services.AddDbContext<VyzioDbContext>(options =>
                    options.UseSqlite(_connection).UseSnakeCaseNamingConvention());
                using var scope = services.BuildServiceProvider().CreateScope();
                scope.ServiceProvider.GetRequiredService<VyzioDbContext>().Database.Migrate();
            }
            else
            {
                using (var create = new SqliteConnection($"Data Source={DatabaseFile};Pooling=False")) create.Open();
                services.AddDbContext<VyzioDbContext>(options =>
                    options.UseSqlite($"Data Source={DatabaseFile};Mode=ReadWrite;Pooling=False").UseSnakeCaseNamingConvention());
            }
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (!disposing) return;
        _connection.Dispose();
        SqliteConnection.ClearAllPools();
        if (DatabaseFile is not null && File.Exists(DatabaseFile)) File.Delete(DatabaseFile);
    }
}
