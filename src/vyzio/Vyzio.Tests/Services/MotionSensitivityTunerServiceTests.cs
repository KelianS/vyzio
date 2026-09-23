using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;
using Vyzio.Application.Services;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Tests.Services.Hosting;

namespace Vyzio.Tests.Services;

public class MotionSensitivityTunerServiceTests
{
    private static readonly TimeSpan Step = TimeSpan.FromMinutes(1);

    private readonly IFrigateStatsProvider _stats = Substitute.For<IFrigateStatsProvider>();
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly IFrigateMotionSettingsPublisher _publisher = Substitute.For<IFrigateMotionSettingsPublisher>();
    private static readonly DateTimeOffset Start = new(2026, 9, 23, 10, 0, 0, TimeSpan.Zero);

    private readonly FakeTimeProvider _time = new(Start);

    // No warm-up, so the first sample is enough to decide.
    private static readonly MotionTuningOptions Immediate = new()
    {
        SampleInterval = TimeSpan.FromMinutes(5),
        MinimumWindowCoverage = TimeSpan.Zero,
    };

    private MotionSensitivityTunerService CreateSut(MotionTuningOptions options) => new(
        BackgroundLoop.Scopes(services => services
            .AddSingleton(_stats)
            .AddSingleton(_cameras)
            .AddSingleton(_publisher)),
        new MotionSensitivityTuner(options),
        options,
        _time,
        NullLogger<MotionSensitivityTunerService>.Instance);

    private static Camera NoisyCamera() => new()
    {
        Id = "cam-garden",
        Slug = "garden",
        DisplayName = "Jardin",
        Host = "192.168.1.20",
        Port = 554,
        FrigateCameraName = "garden",
        IsEnabled = true,
        ValidationState = "validated",
        MotionSensitivity = MotionSensitivity.High,
    };

    // Five inferences per frame: a scene the tuner must desensitise.
    private static FrigateStats Busy() => new(null, [new CameraFps("garden", 5, 25)]);

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
    public async Task ExecuteAsync_ShouldLowerAndSaveTheSensitivity_WhenACameraRunsTooManyInferences()
    {
        // Arrange
        var camera = NoisyCamera();
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([camera]);
        _stats.TryGetStatsAsync(Arg.Any<CancellationToken>()).Returns(Busy());
        _publisher.TryPublishSensitivityAsync("garden", MotionSensitivity.Medium, Arg.Any<CancellationToken>())
            .Returns(true);
        var updated = SignalOnUpdate();
        var sut = CreateSut(Immediate);

        // Act
        await sut.StartAsync(CancellationToken.None);
        await _time.AdvanceUntilAsync(updated.Task, Step);
        await sut.StopAsync(CancellationToken.None);

        // Assert
        Assert.Equal(MotionSensitivity.Medium, camera.MotionSensitivity);
        Assert.InRange(camera.UpdatedAt, Start, _time.GetUtcNow());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepTheSavedLevel_WhenFrigateRefusesTheNewOne()
    {
        // Arrange
        var camera = NoisyCamera();
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([camera]);
        var secondPass = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var passes = 0;
        _stats.TryGetStatsAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (++passes == 2) secondPass.TrySetResult();
            return Busy();
        });
        _publisher.TryPublishSensitivityAsync(Arg.Any<string>(), Arg.Any<MotionSensitivity>(), Arg.Any<CancellationToken>())
            .Returns(false);
        var sut = CreateSut(Immediate);

        // Act
        await sut.StartAsync(CancellationToken.None);
        await _time.AdvanceUntilAsync(secondPass.Task, Step);
        await sut.StopAsync(CancellationToken.None);

        // Assert
        Assert.Equal(MotionSensitivity.High, camera.MotionSensitivity);
        await _publisher.Received().TryPublishSensitivityAsync("garden", MotionSensitivity.Medium, Arg.Any<CancellationToken>());
        await _cameras.DidNotReceive().UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldTuneOnTheNextPass_WhenFrigateStatisticsFailOnce()
    {
        // Arrange
        var camera = NoisyCamera();
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([camera]);
        _stats.TryGetStatsAsync(Arg.Any<CancellationToken>())
            .Returns(_ => throw new HttpRequestException("Frigate restarting"), _ => Task.FromResult<FrigateStats?>(Busy()));
        _publisher.TryPublishSensitivityAsync(Arg.Any<string>(), Arg.Any<MotionSensitivity>(), Arg.Any<CancellationToken>())
            .Returns(true);
        var updated = SignalOnUpdate();
        var sut = CreateSut(Immediate);

        // Act
        await sut.StartAsync(CancellationToken.None);
        await _time.AdvanceUntilAsync(updated.Task, Step);
        await sut.StopAsync(CancellationToken.None);

        // Assert
        Assert.Equal(MotionSensitivity.Medium, camera.MotionSensitivity);
        await _stats.Received(2).TryGetStatsAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldNeverReadFrigate_WhenAutoTuningIsDisabled()
    {
        // Arrange
        var sut = CreateSut(new MotionTuningOptions { Enabled = false });

        // Act
        await sut.StartAsync(CancellationToken.None);
        await sut.ExecuteTask!.ObservedAsync();

        // Assert
        await _stats.DidNotReceive().TryGetStatsAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task StopAsync_ShouldEndTheLoop_WhenTheHostShutsDown()
    {
        // Arrange
        var sut = CreateSut(Immediate);
        await sut.StartAsync(CancellationToken.None);

        // Act
        await sut.StopWithinGuardAsync();

        // Assert
        Assert.True(sut.ExecuteTask!.IsCompleted);
        Assert.False(sut.ExecuteTask.IsFaulted);
    }
}
