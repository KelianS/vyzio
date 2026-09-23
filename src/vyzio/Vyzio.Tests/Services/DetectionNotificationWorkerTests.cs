using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Application.Services;
using Vyzio.Application.UseCases.Notifications;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Services;
using Vyzio.Tests.Services.Hosting;

namespace Vyzio.Tests.Services;

public class DetectionNotificationWorkerTests
{
    private readonly DetectionNotificationQueue _queue = new();
    private readonly IFrigateEventReader _events = Substitute.For<IFrigateEventReader>();
    private readonly IDetectionNotificationDispatcher _dispatcher = Substitute.For<IDetectionNotificationDispatcher>();

    private DetectionNotificationWorker CreateSut() => new(
        _queue,
        BackgroundLoop.Scopes(services => services.AddSingleton(
            new NotifyDetectionUseCase(_events, _dispatcher, NullLogger<NotifyDetectionUseCase>.Instance))),
        NullLogger<DetectionNotificationWorker>.Instance);

    private static FrigateDetection Detection(string eventId) =>
        new(eventId, "front_door", "person", null, 0.91f, DateTimeOffset.UnixEpoch, true, true);

    private TaskCompletionSource SignalOnDispatch(string eventId)
    {
        var dispatched = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        _dispatcher.ExecuteAsync(Arg.Is<FrigateDetection>(d => d.EventId == eventId), Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                dispatched.TrySetResult();
                return true;
            });
        return dispatched;
    }

    [Fact]
    public async Task ExecuteAsync_ShouldNotify_WhenADetectionIsQueued()
    {
        // Arrange
        var dispatched = SignalOnDispatch("evt-1");
        var sut = CreateSut();
        await sut.StartAsync(CancellationToken.None);

        // Act
        _queue.TryEnqueue(Detection("evt-1"));
        await dispatched.Task.ObservedAsync();
        await sut.StopAsync(CancellationToken.None);

        // Assert
        await _dispatcher.Received(1).ExecuteAsync(Arg.Any<FrigateDetection>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldNotifyTheNextDetection_WhenOneNotificationFails()
    {
        // Arrange
        _dispatcher.ExecuteAsync(Arg.Is<FrigateDetection>(d => d.EventId == "evt-1"), Arg.Any<CancellationToken>())
            .Returns<bool>(_ => throw new HttpRequestException("Telegram unreachable"));
        var dispatched = SignalOnDispatch("evt-2");
        var sut = CreateSut();
        await sut.StartAsync(CancellationToken.None);

        // Act
        _queue.TryEnqueue(Detection("evt-1"));
        _queue.TryEnqueue(Detection("evt-2"));
        await dispatched.Task.ObservedAsync();
        await sut.StopAsync(CancellationToken.None);

        // Assert
        await _dispatcher.Received(2).ExecuteAsync(Arg.Any<FrigateDetection>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task StopAsync_ShouldEndTheLoop_WhenTheHostShutsDown()
    {
        // Arrange
        var sut = CreateSut();
        await sut.StartAsync(CancellationToken.None);

        // Act
        await sut.StopWithinGuardAsync();

        // Assert
        Assert.True(sut.ExecuteTask!.IsCompleted);
        Assert.False(sut.ExecuteTask.IsFaulted);
    }
}
