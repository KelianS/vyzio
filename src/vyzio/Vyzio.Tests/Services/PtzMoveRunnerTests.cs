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
    private readonly TaskCompletionSource _released = new(TaskCreationOptions.RunContinuationsAsynchronously);
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
    public async Task HoldAsync_ShouldStopOnTheRelease_WhenReleasedPastTheMinimum()
    {
        // Arrange
        var movedAt = _time.GetUtcNow();
        var stopped = await MakeRunner().HoldAsync(_camera, _ => Task.CompletedTask, _ => Stop(), _released.Task, CancellationToken.None);
        _time.Advance(TimeSpan.FromSeconds(2));

        // Act
        _released.SetResult();

        // Assert
        Assert.Equal(TimeSpan.FromSeconds(2), await stopped!);
        Assert.Equal(movedAt + TimeSpan.FromSeconds(2), await _stopSentAt.Task);
    }

    [Fact]
    public async Task HoldAsync_ShouldMoveForTheMinimum_WhenReleasedBeforeTheMinimum()
    {
        // Arrange
        var movedAt = _time.GetUtcNow();
        var stopped = await MakeRunner().HoldAsync(_camera, _ => Task.CompletedTask, _ => Stop(), _released.Task, CancellationToken.None);
        _time.Advance(TimeSpan.FromMilliseconds(50));
        _released.SetResult();

        // Act
        _time.Advance(PtzMoveRunner.MinimumHold - TimeSpan.FromMilliseconds(50));

        // Assert
        Assert.Equal(PtzMoveRunner.MinimumHold, await stopped!);
        Assert.Equal(movedAt + PtzMoveRunner.MinimumHold, await _stopSentAt.Task);
    }

    [Fact]
    public async Task HoldAsync_ShouldMoveForTheMinimum_WhenReleasedBeforeTheMoveWentOut()
    {
        // Arrange
        _released.SetResult();
        var movedAt = _time.GetUtcNow();
        var stopped = await MakeRunner().HoldAsync(_camera, _ => Task.CompletedTask, _ => Stop(), _released.Task, CancellationToken.None);

        // Act
        _time.Advance(PtzMoveRunner.MinimumHold);

        // Assert
        Assert.Equal(PtzMoveRunner.MinimumHold, await stopped!);
        Assert.Equal(movedAt + PtzMoveRunner.MinimumHold, await _stopSentAt.Task);
    }

    [Fact]
    public async Task HoldAsync_ShouldStopWithoutWaitingForTheMovesAnswer_WhenReleasedPastTheMinimum()
    {
        // Arrange
        var movedAt = _time.GetUtcNow();
        var holding = MakeRunner().HoldAsync(_camera, _ => _moveAnswer.Task, _ => Stop(), _released.Task, CancellationToken.None);
        _time.Advance(TimeSpan.FromMilliseconds(400));

        // Act
        _released.SetResult();

        // Assert
        Assert.Equal(movedAt + TimeSpan.FromMilliseconds(400), await _stopSentAt.Task);
        _moveAnswer.SetResult();
        Assert.Equal(TimeSpan.FromMilliseconds(400), await (await holding)!);
    }

    [Fact]
    public async Task HoldAsync_ShouldStopAtOnceAndRaiseTheMovesError_WhenTheCameraRefusesTheMove()
    {
        // Arrange
        var movedAt = _time.GetUtcNow();

        // Act
        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(() => MakeRunner().HoldAsync(_camera,
            _ => Task.FromException(new CameraCommandRefusedException("refused")), _ => Stop(), _released.Task, CancellationToken.None));

        // Assert
        Assert.Equal("refused", error.Message);
        Assert.Equal(movedAt, await _stopSentAt.Task);
    }

    [Fact]
    public async Task HoldAsync_ShouldSkipOtherMovesOfTheCamera_WhenTheMoveIsStillHeld()
    {
        // Arrange
        var runner = MakeRunner();
        var stopped = await runner.HoldAsync(_camera, _ => Task.CompletedTask, _ => Stop(), _released.Task, CancellationToken.None);
        var skipped = runner.RunAsync(_camera, _ => Task.CompletedTask, CancellationToken.None);

        // Act
        _time.Advance(PtzMoveRunner.BusyWait);

        // Assert
        Assert.False(await skipped);
        _released.SetResult();
        await stopped!;
        Assert.True(await runner.RunAsync(_camera, _ => Task.CompletedTask, CancellationToken.None));
    }

    [Fact]
    public async Task HoldAsync_ShouldFreeTheCamera_WhenTheStopFails()
    {
        // Arrange
        var runner = MakeRunner();
        var stopped = await runner.HoldAsync(_camera,
            _ => Task.CompletedTask, _ => Task.FromException(new CameraUnreachableException("stop lost")), _released.Task, CancellationToken.None);
        _released.SetResult();

        // Act
        _time.Advance(PtzMoveRunner.MinimumHold);

        // Assert
        await Assert.ThrowsAsync<CameraUnreachableException>(() => stopped!);
        Assert.True(await runner.RunAsync(_camera, _ => Task.CompletedTask, CancellationToken.None));
    }
}
