using System.Net;
using System.Net.Sockets;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;
using Vyzio.Application.Services;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Tests.Services.Hosting;

namespace Vyzio.Tests.Services;

public class CameraReachabilityPollerServiceTests
{
    private static readonly TimeSpan Step = TimeSpan.FromSeconds(15);

    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private static readonly DateTimeOffset Start = new(2026, 9, 23, 10, 0, 0, TimeSpan.Zero);

    private readonly FakeTimeProvider _time = new(Start);

    private CameraReachabilityPollerService CreateSut() => new(
        BackgroundLoop.Scopes(services => services.AddSingleton(_cameras)),
        _time,
        NullLogger<CameraReachabilityPollerService>.Instance);

    private static Camera ValidatedCamera(int port, string status) => new()
    {
        Id = "cam-1",
        Slug = "cam-1",
        DisplayName = "Entrée",
        FrigateCameraName = "entree",
        Host = "127.0.0.1",
        Port = port,
        Status = status,
        ValidationState = "validated",
    };

    private TaskCompletionSource<DateTimeOffset> SignalOnUpdate()
    {
        var updated = new TaskCompletionSource<DateTimeOffset>(TaskCreationOptions.RunContinuationsAsynchronously);
        _cameras.UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                updated.TrySetResult(_time.GetUtcNow());
                return Task.CompletedTask;
            });
        return updated;
    }

    [Fact]
    public async Task ExecuteAsync_ShouldMarkTheCameraOffline_WhenItStopsAnswering()
    {
        // Arrange
        using var refusing = BackgroundLoop.RefusingPort();
        var camera = ValidatedCamera(refusing.PortOf(), "online");
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([camera]);
        var updated = SignalOnUpdate();
        var sut = CreateSut();

        // Act
        await sut.StartAsync(CancellationToken.None);
        await _time.AdvanceUntilAsync(updated.Task, Step);
        await sut.StopAsync(CancellationToken.None);

        // Assert
        Assert.Equal("offline", camera.Status);
        Assert.InRange(camera.LastReachabilityCheckAt!.Value, Start, _time.GetUtcNow());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldMarkTheCameraOnline_WhenItAnswersAgain()
    {
        // Arrange
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var camera = ValidatedCamera(((IPEndPoint)listener.LocalEndpoint).Port, "offline");
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([camera]);
        var updated = SignalOnUpdate();
        var sut = CreateSut();

        // Act
        await sut.StartAsync(CancellationToken.None);
        await _time.AdvanceUntilAsync(updated.Task, Step);
        await sut.StopAsync(CancellationToken.None);
        listener.Stop();

        // Assert
        Assert.Equal("online", camera.Status);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepPolling_WhenReadingTheCamerasFailsOnce()
    {
        // Arrange
        using var refusing = BackgroundLoop.RefusingPort();
        var camera = ValidatedCamera(refusing.PortOf(), "online");
        _cameras.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns(
                _ => throw new InvalidOperationException("database is locked"),
                _ => Task.FromResult<IReadOnlyList<Camera>>([camera]));
        var updated = SignalOnUpdate();
        var sut = CreateSut();

        // Act
        await sut.StartAsync(CancellationToken.None);
        await _time.AdvanceUntilAsync(updated.Task, Step);
        await sut.StopAsync(CancellationToken.None);

        // Assert
        Assert.Equal("offline", camera.Status);
        await _cameras.Received(2).GetAllAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task StopAsync_ShouldEndTheLoop_WhenTheHostShutsDown()
    {
        // Arrange
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);
        var sut = CreateSut();
        await sut.StartAsync(CancellationToken.None);

        // Act
        await sut.StopWithinGuardAsync();

        // Assert
        Assert.True(sut.ExecuteTask!.IsCompleted);
        Assert.False(sut.ExecuteTask.IsFaulted);
    }
}
