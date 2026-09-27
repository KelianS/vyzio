using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class PtzManagedPositionsTests
{
    private static readonly TimeSpan FullRange = TimeSpan.FromSeconds(10);

    private readonly FakeTimeProvider _time = new();
    private readonly IPtzCapabilityProvider _provider = Substitute.For<IPtzCapabilityProvider>();
    private readonly IPtzMotion _motion = Substitute.For<IPtzMotion>();
    private readonly PtzManagedPositions _sut;
    private readonly Camera _camera = new() { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "192.168.1.10" };
    private readonly CameraCapabilityBinding _binding = new()
    {
        CameraId = "cam1",
        Capability = CameraCapability.Ptz,
        Protocol = SupportedProtocol.Dvrip,
        Verified = true,
    };

    public PtzManagedPositionsTests()
    {
        _sut = new(_time, NullLogger<PtzManagedPositions>.Instance);
        _provider.FullRange.Returns(FullRange);
        _provider.OpenMotionAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(_motion);
        _motion.MoveForAsync(Arg.Any<PtzDirection>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(call => call.ArgAt<TimeSpan>(2));
        _motion.StartAsync(Arg.Any<PtzDirection>(), Arg.Any<int>(), Arg.Any<Task>(), Arg.Any<CancellationToken>()).Returns(true);
        _motion.StoppedAsync().Returns(Ms(100));
    }

    private static TimeSpan Ms(int milliseconds) => TimeSpan.FromMilliseconds(milliseconds);

    private async Task Press(PtzDirection direction)
    {
        await StartHold(direction);
        await _sut.StopHoldAsync("cam1");
    }

    private Task Home() => _sut.HomeAsync(_camera, _binding, _provider, CancellationToken.None);

    private Task<bool> StartHold(PtzDirection direction) => StartHold(direction, Task.FromResult<IPtzMotion>(_motion));

    private Task<bool> StartHold(PtzDirection direction, Task<IPtzMotion> opening, Task? resolving = null)
    {
        _provider.OpenMotionAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(opening);
        return _sut.StartHoldAsync("cam1", async () =>
        {
            await (resolving ?? Task.CompletedTask);
            return new PtzPress(_camera, _binding, _provider, direction, 50);
        }, CancellationToken.None);
    }

    private Task Started(int count, PtzDirection direction, Func<Task, bool> released)
        => _motion.Received(count).StartAsync(direction, 50, Arg.Is<Task>(task => released(task)), Arg.Any<CancellationToken>());

    private Task GoTo(int x, int y) => _sut.GoToAsync(_camera, _binding, _provider, x, y, CancellationToken.None);

    private Task MovedFor(int count, PtzDirection direction, TimeSpan duration)
        => _motion.Received(count).MoveForAsync(direction, Arg.Any<int>(), duration, Arg.Any<CancellationToken>());

    private Task MovedAny(int count, PtzDirection direction)
        => _motion.Received(count).MoveForAsync(direction, Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>());

    private void MoveForReturns(PtzDirection direction, TimeSpan moved)
        => _motion.MoveForAsync(direction, Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>()).Returns(moved);

    private void MoveForThrows(PtzDirection direction, Exception error)
        => _motion.MoveForAsync(direction, Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>()).ThrowsAsync(error);

    [Fact]
    public async Task HomeAsync_ShouldMoveUpLeftForTheFullRangePlusTheMarginAndSetTheOrigin_WhenThePositionIsUnknown()
    {
        // Arrange

        // Act
        await Home();

        // Assert
        await MovedFor(1, PtzDirection.UpLeft, FullRange + PtzManagedPositions.HomingMargin);
        Assert.Equal((0, 0), _sut.Current("cam1"));
    }

    [Fact]
    public async Task HomeAsync_ShouldMoveBackOnlyTheKnownPositionPlusTheMargin_WhenThePositionIsKnown()
    {
        // Arrange
        await Home();
        await Press(PtzDirection.Right);
        await Press(PtzDirection.Right);
        await Press(PtzDirection.Right);
        _motion.ClearReceivedCalls();

        // Act
        await Home();

        // Assert
        await MovedFor(1, PtzDirection.UpLeft, Ms(300) + PtzManagedPositions.HomingMargin);
        Assert.Equal((0, 0), _sut.Current("cam1"));
    }

    [Fact]
    public async Task HomeAsync_ShouldStillSetTheOrigin_WhenTheCameraFellShortWithinTheMargin()
    {
        // Arrange
        MoveForReturns(PtzDirection.UpLeft, FullRange);

        // Act
        await Home();

        // Assert
        Assert.Equal((0, 0), _sut.Current("cam1"));
    }

    [Fact]
    public async Task HomeAsync_ShouldRefuseAndKeepThePositionUnknown_WhenTheMoveIsSkipped()
    {
        // Arrange
        MoveForReturns(PtzDirection.UpLeft, TimeSpan.Zero);

        // Act
        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(Home);

        // Assert
        Assert.Contains("moved 0 of the 10200 ms", error.Message, StringComparison.Ordinal);
        Assert.Null(_sut.Current("cam1"));
    }

    [Fact]
    public async Task HomeAsync_ShouldRaiseTheCamerasErrorAndForgetThePosition_WhenTheMoveFails()
    {
        // Arrange
        await Home();
        MoveForThrows(PtzDirection.UpLeft, new CameraUnreachableException("DVRIP PTZ DirectionRightUp on 192.168.1.10: connection refused"));

        // Act
        var error = await Assert.ThrowsAsync<CameraUnreachableException>(Home);

        // Assert
        Assert.Contains("connection refused", error.Message, StringComparison.Ordinal);
        Assert.Null(_sut.Current("cam1"));
    }

    [Fact]
    public async Task HomeAsync_ShouldCloseTheSession_WhenTheMoveFails()
    {
        // Arrange
        MoveForThrows(PtzDirection.UpLeft, new CameraCommandRefusedException("DVRIP PTZ DirectionRightUp refused by 192.168.1.10 (Ret=103)."));

        // Act
        await Assert.ThrowsAsync<CameraCommandRefusedException>(Home);

        // Assert
        await _motion.Received(1).DisposeAsync();
    }

    [Fact]
    public async Task HomeAsync_ShouldRaiseTheCamerasErrorAndKeepThePositionUnknown_WhenTheSessionCannotBeOpened()
    {
        // Arrange
        _provider.OpenMotionAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new CameraCommandRefusedException("DVRIP login refused by 192.168.1.10 (Ret=203)."));

        // Act
        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(Home);

        // Assert
        Assert.Contains("Ret=203", error.Message, StringComparison.Ordinal);
        await MovedAny(0, PtzDirection.UpLeft);
        Assert.Null(_sut.Current("cam1"));
    }

    [Fact]
    public async Task StopHoldAsync_ShouldAddTheMeasuredMotionTimeOnEachAxisItMoves_WhenThePositionIsKnown()
    {
        // Arrange
        await Home();
        _motion.StoppedAsync().Returns(Ms(1234), Ms(100), Ms(100));

        // Act
        await Press(PtzDirection.DownRight);
        await Press(PtzDirection.Right);
        await Press(PtzDirection.Down);

        // Assert
        Assert.Equal((1334, 1334), _sut.Current("cam1"));
    }

    [Fact]
    public async Task StopHoldAsync_ShouldMoveWithoutInventingAPosition_WhenTheCameraWasNeverHomed()
    {
        // Arrange

        // Act
        await Press(PtzDirection.Right);

        // Assert
        await Started(1, PtzDirection.Right, _ => true);
        Assert.Null(_sut.Current("cam1"));
    }

    [Fact]
    public async Task StartHoldAsync_ShouldKeepItsSessionOpenAndTheMoveUnreleased_WhenThePressLasts()
    {
        // Arrange

        // Act
        var found = await StartHold(PtzDirection.Left);

        // Assert
        Assert.True(found);
        await Started(1, PtzDirection.Left, released => !released.IsCompleted);
        await _motion.DidNotReceive().DisposeAsync();
    }

    [Fact]
    public async Task StopHoldAsync_ShouldReleaseTheMoveAndCloseTheOneSessionOfThePress_WhenThePressIsReleased()
    {
        // Arrange
        await StartHold(PtzDirection.Left);

        // Act
        await _sut.StopHoldAsync("cam1");

        // Assert
        await _provider.Received(1).OpenMotionAsync(_camera, _binding, Arg.Any<CancellationToken>());
        await Started(1, PtzDirection.Left, released => released.IsCompleted);
        await _motion.Received(1).StoppedAsync();
        await _motion.Received(1).DisposeAsync();
    }

    [Fact]
    public async Task StopHoldAsync_ShouldStillMoveThenStop_WhenTheReleaseArrivesBeforeTheSessionIsOpen()
    {
        // Arrange
        await Home();
        _motion.ClearReceivedCalls();
        var opening = new TaskCompletionSource<IPtzMotion>(TaskCreationOptions.RunContinuationsAsynchronously);
        var start = StartHold(PtzDirection.Right, opening.Task);
        var stop = _sut.StopHoldAsync("cam1");

        // Act
        opening.SetResult(_motion);
        await start;
        await stop;

        // Assert
        await Started(1, PtzDirection.Right, released => released.IsCompleted);
        await _motion.Received(1).StoppedAsync();
        await _motion.Received(1).DisposeAsync();
        Assert.Equal((100, 0), _sut.Current("cam1"));
    }

    [Fact]
    public async Task StopHoldAsync_ShouldStillEndThePress_WhenTheReleaseArrivesWhileTheCameraIsResolved()
    {
        // Arrange
        var resolving = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var start = StartHold(PtzDirection.Right, Task.FromResult(_motion), resolving.Task);
        var stop = _sut.StopHoldAsync("cam1");

        // Act
        resolving.SetResult();
        await start;
        await stop;

        // Assert
        await Started(1, PtzDirection.Right, released => released.IsCompleted);
        await _motion.Received(1).DisposeAsync();
        Assert.False(_sut.SignalHold("cam1"));
    }

    [Fact]
    public async Task StartHoldAsync_ShouldStopTheMoveByItself_WhenTheInterfaceStopsSignallingIt()
    {
        // Arrange
        await Home();
        _motion.ClearReceivedCalls();
        _motion.StoppedAsync().Returns(PtzManagedPositions.HoldTimeout);
        await StartHold(PtzDirection.Right);

        // Act
        _time.Advance(PtzManagedPositions.HoldTimeout);

        // Assert
        await Started(1, PtzDirection.Right, released => released.IsCompleted);
        await _motion.Received(1).StoppedAsync();
        await _motion.Received(1).DisposeAsync();
        Assert.Equal((3000, 0), _sut.Current("cam1"));
        Assert.False(_sut.SignalHold("cam1"));
    }

    [Fact]
    public async Task SignalHold_ShouldKeepTheMoveGoing_WhenTheInterfaceSignalsWithinTheTimeout()
    {
        // Arrange
        await StartHold(PtzDirection.Right);
        _time.Advance(TimeSpan.FromSeconds(2));

        // Act
        var held = _sut.SignalHold("cam1");
        _time.Advance(TimeSpan.FromSeconds(2));

        // Assert
        Assert.True(held);
        await Started(1, PtzDirection.Right, released => !released.IsCompleted);
        await _motion.DidNotReceive().StoppedAsync();
    }

    [Fact]
    public async Task StopHoldAsync_ShouldRaiseAndForgetThePosition_WhenTheStopFails()
    {
        // Arrange
        await Home();
        _motion.ClearReceivedCalls();
        _motion.StoppedAsync().ThrowsAsync(new CameraUnreachableException("No DVRIP answer from 192.168.1.10 (connection closed by the camera)."));
        await StartHold(PtzDirection.Right);

        // Act
        await Assert.ThrowsAsync<CameraUnreachableException>(() => _sut.StopHoldAsync("cam1"));

        // Assert
        Assert.Null(_sut.Current("cam1"));
        await _motion.Received(1).DisposeAsync();
    }

    [Fact]
    public async Task StartHoldAsync_ShouldCloseTheSessionAndKeepThePosition_WhenTheMoveIsSkipped()
    {
        // Arrange
        await Home();
        _motion.ClearReceivedCalls();
        _motion.StartAsync(Arg.Any<PtzDirection>(), Arg.Any<int>(), Arg.Any<Task>(), Arg.Any<CancellationToken>()).Returns(false);

        // Act
        var found = await StartHold(PtzDirection.Right);

        // Assert
        Assert.True(found);
        await _motion.Received(1).DisposeAsync();
        Assert.False(_sut.SignalHold("cam1"));
        Assert.Equal((0, 0), _sut.Current("cam1"));
    }

    [Fact]
    public async Task StartHoldAsync_ShouldAnswerNotFoundAndHoldNothing_WhenThePressResolvesToNoCamera()
    {
        // Arrange

        // Act
        var found = await _sut.StartHoldAsync("cam1", () => Task.FromResult<PtzPress?>(null), CancellationToken.None);

        // Assert
        Assert.False(found);
        Assert.False(_sut.SignalHold("cam1"));
    }

    [Fact]
    public async Task StartHoldAsync_ShouldRaiseCloseTheSessionAndForgetThePosition_WhenTheCameraRefusesTheMove()
    {
        // Arrange
        await Home();
        _motion.ClearReceivedCalls();
        _motion.StartAsync(Arg.Any<PtzDirection>(), Arg.Any<int>(), Arg.Any<Task>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new CameraCommandRefusedException("DVRIP PTZ DirectionLeft refused by 192.168.1.10 (Ret=103)."));

        // Act
        await Assert.ThrowsAsync<CameraCommandRefusedException>(() => StartHold(PtzDirection.Right));

        // Assert
        await _motion.Received(1).DisposeAsync();
        Assert.False(_sut.SignalHold("cam1"));
        Assert.Null(_sut.Current("cam1"));
    }

    [Fact]
    public async Task StartHoldAsync_ShouldEndThePreviousHold_WhenANewPressStarts()
    {
        // Arrange
        await Home();
        _motion.StoppedAsync().Returns(Ms(500));
        await StartHold(PtzDirection.Right);

        // Act
        await StartHold(PtzDirection.Down);

        // Assert
        await _motion.Received(1).StoppedAsync();
        Assert.Equal((500, 0), _sut.Current("cam1"));
        Assert.True(_sut.SignalHold("cam1"));
    }

    [Fact]
    public async Task StartHoldAsync_ShouldEndThePreviousPress_WhenANewPressArrivesWhileItsSessionOpens()
    {
        // Arrange
        var late = Substitute.For<IPtzMotion>();
        late.StartAsync(Arg.Any<PtzDirection>(), Arg.Any<int>(), Arg.Any<Task>(), Arg.Any<CancellationToken>()).Returns(true);
        var opening = new TaskCompletionSource<IPtzMotion>(TaskCreationOptions.RunContinuationsAsynchronously);
        var first = StartHold(PtzDirection.Left, opening.Task);
        var second = StartHold(PtzDirection.Right);

        // Act
        opening.SetResult(late);
        await first;
        await second;

        // Assert
        await late.Received(1).StartAsync(PtzDirection.Left, 50, Arg.Is<Task>(released => released.IsCompleted), Arg.Any<CancellationToken>());
        await late.Received(1).StoppedAsync();
        await late.Received(1).DisposeAsync();
        await _motion.DidNotReceive().StoppedAsync();
        Assert.True(_sut.SignalHold("cam1"));
    }
    [Fact]
    public async Task GoToAsync_ShouldMoveEachAxisOnceForTheDifference_WhenThePositionIsKnown()
    {
        // Arrange
        await Home();
        await Press(PtzDirection.Right);
        await Press(PtzDirection.Right);
        await Press(PtzDirection.Right);
        await Press(PtzDirection.Down);
        _motion.ClearReceivedCalls();

        // Act
        await GoTo(100, 300);

        // Assert
        await MovedAny(0, PtzDirection.UpLeft);
        await MovedFor(1, PtzDirection.Left, Ms(200));
        await MovedFor(1, PtzDirection.Down, Ms(200));
        Assert.Equal((100, 300), _sut.Current("cam1"));
    }

    [Fact]
    public async Task GoToAsync_ShouldRaiseAndCountOnlyWhatMoved_WhenTheMoveIsCutShort()
    {
        // Arrange
        await Home();
        MoveForReturns(PtzDirection.Right, Ms(200));

        // Act
        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(() => GoTo(300, 0));

        // Assert
        Assert.Contains("stopped 100 ms short", error.Message, StringComparison.Ordinal);
        Assert.Equal((200, 0), _sut.Current("cam1"));
    }

    [Fact]
    public async Task GoToAsync_ShouldRaiseAndForgetThePosition_WhenTheCameraFailsAMove()
    {
        // Arrange
        await Home();
        MoveForThrows(PtzDirection.Right, new CameraUnreachableException("DVRIP service on 192.168.1.10: connection reset"));

        // Act
        await Assert.ThrowsAsync<CameraUnreachableException>(() => GoTo(300, 0));

        // Assert
        Assert.Null(_sut.Current("cam1"));
    }

    [Fact]
    public async Task GoToAsync_ShouldHomeThenMoveToTheTargetOnOneSessionClosedAfterwards_WhenThePositionIsUnknown()
    {
        // Arrange

        // Act
        await GoTo(400, 200);

        // Assert
        await _provider.Received(1).OpenMotionAsync(_camera, _binding, Arg.Any<CancellationToken>());
        await MovedFor(1, PtzDirection.UpLeft, FullRange + PtzManagedPositions.HomingMargin);
        await MovedFor(1, PtzDirection.Right, Ms(400));
        await MovedFor(1, PtzDirection.Down, Ms(200));
        await _motion.Received(1).DisposeAsync();
        Assert.Equal((400, 200), _sut.Current("cam1"));
    }

    [Fact]
    public async Task GoToAsync_ShouldOpenNoSession_WhenTheCameraIsAlreadyThere()
    {
        // Arrange
        await Home();
        _provider.ClearReceivedCalls();

        // Act
        await GoTo(0, 0);

        // Assert
        await _provider.DidNotReceive().OpenMotionAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }
}
