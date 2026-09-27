using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.CapabilityProviders;

namespace Vyzio.Tests.Services;

public class PtzSteppedMotionTests
{
    private static readonly TimeSpan PacketLength = TimeSpan.FromMilliseconds(100);
    private static readonly Camera Camera = new() { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "192.168.1.10" };

    private static FakeSteppedMotion MakeMotion(params Func<Task>[] packets)
        => new(new PtzMoveRunner(new FakeTimeProvider(), NullLogger<PtzMoveRunner>.Instance), packets);

    private static Task Taken() => Task.CompletedTask;

    private static Task Lost() => Task.FromException(new CameraUnreachableException("V380 PTZ step on 192.168.1.10: connection reset"));

    [Fact]
    public async Task MoveForAsync_ShouldSendOnePacketPerPacketLength_WhenTheCameraTakesThemAll()
    {
        // Arrange
        var motion = MakeMotion(Taken);

        // Act
        var moved = await motion.MoveForAsync(PtzDirection.Right, 50, TimeSpan.FromMilliseconds(500));

        // Assert
        Assert.Equal(TimeSpan.FromMilliseconds(500), moved);
        Assert.Equal(5, motion.Sent);
    }

    [Fact]
    public async Task MoveForAsync_ShouldCountOnlyThePacketsTaken_WhenFewerAreLostThanTheMargin()
    {
        // Arrange
        var motion = MakeMotion(Taken, Lost, Taken, Lost, Taken);

        // Act
        var moved = await motion.MoveForAsync(PtzDirection.UpLeft, 50, TimeSpan.FromMilliseconds(500));

        // Assert
        Assert.Equal(TimeSpan.FromMilliseconds(300), moved);
    }

    [Fact]
    public async Task MoveForAsync_ShouldRaiseTheCamerasError_WhenTheFirstPacketFails()
    {
        // Arrange
        var motion = MakeMotion(Lost);

        // Act
        await Assert.ThrowsAsync<CameraUnreachableException>(() => motion.MoveForAsync(PtzDirection.UpLeft, 50, TimeSpan.FromMilliseconds(500)));

        // Assert
        Assert.Equal(1, motion.Sent);
    }

    [Fact]
    public async Task MoveForAsync_ShouldRaiseTheCamerasError_WhenMorePacketsAreLostThanTheMargin()
    {
        // Arrange
        var motion = MakeMotion(Taken, Lost, Lost, Lost, Taken);

        // Act
        await Assert.ThrowsAsync<CameraUnreachableException>(() => motion.MoveForAsync(PtzDirection.UpLeft, 50, TimeSpan.FromMilliseconds(500)));

        // Assert
        Assert.Equal(4, motion.Sent);
    }

    [Fact]
    public async Task StoppedAsync_ShouldCountEveryPacketSentUntilTheRelease_WhenAPressIsHeld()
    {
        // Arrange
        var third = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var released = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var motion = MakeMotion(Taken, Taken, () => third.Task);
        Assert.True(await motion.StartAsync(PtzDirection.Right, 50, released.Task));
        await motion.SentAsync(3);

        // Act
        released.SetResult();
        var stopping = motion.StoppedAsync();
        third.SetResult();
        var moved = await stopping;

        // Assert
        Assert.Equal(3 * PacketLength, moved);
        Assert.Equal(3, motion.Sent);
    }

    [Fact]
    public async Task StoppedAsync_ShouldCountOnePacket_WhenThePressIsReleasedBeforeTheFirstPacketWentOut()
    {
        // Arrange
        var motion = MakeMotion(Taken);
        Assert.True(await motion.StartAsync(PtzDirection.Right, 50, Task.CompletedTask));

        // Act
        var moved = await motion.StoppedAsync();

        // Assert
        Assert.Equal(PacketLength, moved);
        Assert.Equal(1, motion.Sent);
    }

    [Fact]
    public async Task StoppedAsync_ShouldRaiseThePacketsError_WhenAPacketFailsDuringTheHold()
    {
        // Arrange
        var motion = MakeMotion(Taken, Lost);
        Assert.True(await motion.StartAsync(PtzDirection.Right, 50, new TaskCompletionSource().Task));
        await motion.SentAsync(2);

        // Act
        var error = await Assert.ThrowsAsync<CameraUnreachableException>(motion.StoppedAsync);

        // Assert
        Assert.Contains("connection reset", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task StartAsync_ShouldRaiseTheCamerasErrorAndRepeatNothing_WhenTheFirstPacketFails()
    {
        // Arrange
        var motion = MakeMotion(Lost, Taken);

        // Act
        await Assert.ThrowsAsync<CameraUnreachableException>(() => motion.StartAsync(PtzDirection.Right, 50, Task.CompletedTask));

        // Assert
        Assert.Equal(TimeSpan.Zero, await motion.StoppedAsync());
        Assert.Equal(1, motion.Sent);
    }

    // Answers each packet with the next of `packets`, the last one repeated.
    private sealed class FakeSteppedMotion(PtzMoveRunner runner, Func<Task>[] packets)
        : PtzSteppedMotion(runner, PtzSteppedMotionTests.Camera, PacketLength, NullLogger.Instance)
    {
        private readonly TaskCompletionSource[] _sent = [.. Enumerable.Range(0, 16).Select(_ => new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously))];
        private int _count;

        public int Sent => Volatile.Read(ref _count);

        public Task SentAsync(int count) => _sent[count - 1].Task.WaitAsync(TimeSpan.FromSeconds(10));

        protected override Task StepAsync(PtzDirection direction, int speed, CancellationToken ct)
        {
            var index = Interlocked.Increment(ref _count) - 1;
            if (index < _sent.Length) _sent[index].TrySetResult();
            return packets[Math.Min(index, packets.Length - 1)]();
        }
    }
}
