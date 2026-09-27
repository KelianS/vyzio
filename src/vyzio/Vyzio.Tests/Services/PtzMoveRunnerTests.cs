using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.CapabilityProviders;

namespace Vyzio.Tests.Services;

public class PtzMoveRunnerTests
{
    private static readonly TimeSpan Duration = TimeSpan.FromMilliseconds(100);

    private readonly FakeTimeProvider _time = new();
    private readonly Camera _camera = new() { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "192.168.1.10" };
    private readonly TaskCompletionSource _moveAnswer = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly TaskCompletionSource<DateTimeOffset> _stopSentAt = new(TaskCreationOptions.RunContinuationsAsynchronously);

    private PtzMoveRunner MakeRunner() => new(_time, NullLogger<PtzMoveRunner>.Instance);

    private Task Stop()
    {
        _stopSentAt.TrySetResult(_time.GetUtcNow());
        return Task.CompletedTask;
    }

    [Fact]
    public async Task RunTimedAsync_ShouldStopTheDurationAfterTheMove_WhenTheCameraHasNotAnsweredTheMoveYet()
    {
        // Arrange
        var movedAt = _time.GetUtcNow();
        var step = MakeRunner().RunTimedAsync(_camera, _ => _moveAnswer.Task, _ => Stop(), Duration, CancellationToken.None);

        // Act
        _time.Advance(Duration);
        var stoppedAt = await _stopSentAt.Task;

        // Assert
        Assert.Equal(Duration, stoppedAt - movedAt);
        _moveAnswer.SetResult();
        Assert.True(await step);
    }

    [Fact]
    public async Task RunTimedAsync_ShouldWaitTheWholeDuration_WhenTheCameraAnswersTheMoveAtOnce()
    {
        // Arrange
        var movedAt = _time.GetUtcNow();
        var step = MakeRunner().RunTimedAsync(_camera, _ => Task.CompletedTask, _ => Stop(), Duration, CancellationToken.None);

        // Act
        _time.Advance(Duration);
        var stoppedAt = await _stopSentAt.Task;

        // Assert
        Assert.Equal(Duration, stoppedAt - movedAt);
        Assert.True(await step);
    }

    [Fact]
    public async Task RunTimedAsync_ShouldStopAtOnceAndRaiseTheMovesError_WhenTheCameraRefusesTheMove()
    {
        // Arrange
        var movedAt = _time.GetUtcNow();

        // Act
        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(() => MakeRunner().RunTimedAsync(_camera,
            _ => Task.FromException(new CameraCommandRefusedException("refused")), _ => Stop(), Duration, CancellationToken.None));

        // Assert
        Assert.Equal("refused", error.Message);
        Assert.Equal(movedAt, await _stopSentAt.Task);
    }

    [Fact]
    public async Task RunTimedAsync_ShouldRaiseTheMovesError_WhenTheStopFailsToo()
    {
        // Arrange

        // Act
        var error = await Assert.ThrowsAsync<CameraUnreachableException>(() => MakeRunner().RunTimedAsync(_camera,
            _ => Task.FromException(new CameraUnreachableException("move lost")),
            _ => Task.FromException(new CameraUnreachableException("stop lost")),
            Duration, CancellationToken.None));

        // Assert
        Assert.Equal("move lost", error.Message);
    }

    [Fact]
    public async Task RunTimedAsync_ShouldRaiseTheStopsError_WhenOnlyTheStopFails()
    {
        // Arrange
        var step = MakeRunner().RunTimedAsync(_camera,
            _ => Task.CompletedTask, _ => Task.FromException(new CameraCommandRefusedException("stop refused")), Duration, CancellationToken.None);

        // Act
        _time.Advance(Duration);

        // Assert
        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(() => step);
        Assert.Equal("stop refused", error.Message);
    }

    [Fact]
    public async Task RunTimedAsync_ShouldStillStop_WhenTheMoveIsCancelled()
    {
        // Arrange
        using var cancel = new CancellationTokenSource();
        var step = MakeRunner().RunTimedAsync(_camera, _ => _moveAnswer.Task, _ => Stop(), Duration, cancel.Token);

        // Act
        await cancel.CancelAsync();
        _moveAnswer.SetResult();

        // Assert
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => step);
        Assert.True(_stopSentAt.Task.IsCompleted);
    }

    [Fact]
    public async Task RunAsync_ShouldSkipTheMove_WhenAnotherMoveOfTheCameraIsStillRunning()
    {
        // Arrange
        var runner = MakeRunner();
        var running = runner.RunAsync(_camera, _ => _moveAnswer.Task, CancellationToken.None);
        var skipped = runner.RunAsync(_camera, _ => Task.CompletedTask, CancellationToken.None);

        // Act
        _time.Advance(PtzMoveRunner.BusyWait);

        // Assert
        Assert.False(await skipped);
        _moveAnswer.SetResult();
        Assert.True(await running);
    }

    [Fact]
    public async Task HoldAsync_ShouldMeasureFromTheMoveSentToTheStopSent_WhenTheCameraAnswersTheMoveLate()
    {
        // Arrange
        var holding = MakeRunner().HoldAsync(_camera, _ => _moveAnswer.Task, _ => Stop(), CancellationToken.None);
        _time.Advance(TimeSpan.FromMilliseconds(400));
        _moveAnswer.SetResult();
        var held = await holding;
        _time.Advance(TimeSpan.FromMilliseconds(1600));

        // Act
        var moved = await held!.StopAsync();

        // Assert
        Assert.Equal(TimeSpan.FromSeconds(2), moved);
    }

    [Fact]
    public async Task HoldAsync_ShouldStopAtOnceAndRaiseTheMovesError_WhenTheCameraRefusesTheMove()
    {
        // Arrange
        var movedAt = _time.GetUtcNow();

        // Act
        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(() => MakeRunner().HoldAsync(_camera,
            _ => Task.FromException(new CameraCommandRefusedException("refused")), _ => Stop(), CancellationToken.None));

        // Assert
        Assert.Equal("refused", error.Message);
        Assert.Equal(movedAt, await _stopSentAt.Task);
    }

    [Fact]
    public async Task HoldAsync_ShouldSkipOtherMovesOfTheCamera_WhenTheMoveIsStillHeld()
    {
        // Arrange
        var runner = MakeRunner();
        var held = await runner.HoldAsync(_camera, _ => Task.CompletedTask, _ => Stop(), CancellationToken.None);
        var skipped = runner.RunAsync(_camera, _ => Task.CompletedTask, CancellationToken.None);

        // Act
        _time.Advance(PtzMoveRunner.BusyWait);

        // Assert
        Assert.False(await skipped);
        await held!.StopAsync();
        Assert.True(await runner.RunAsync(_camera, _ => Task.CompletedTask, CancellationToken.None));
    }

    [Fact]
    public async Task HoldAsync_ShouldFreeTheCamera_WhenTheStopFails()
    {
        // Arrange
        var runner = MakeRunner();
        var held = await runner.HoldAsync(_camera,
            _ => Task.CompletedTask, _ => Task.FromException(new CameraUnreachableException("stop lost")), CancellationToken.None);

        // Act
        await Assert.ThrowsAsync<CameraUnreachableException>(() => held!.StopAsync());

        // Assert
        Assert.True(await runner.RunAsync(_camera, _ => Task.CompletedTask, CancellationToken.None));
    }
}
