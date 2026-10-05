using System.Globalization;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Tests.Services.Hosting;

namespace Vyzio.Tests.Services;

public class PrivacySchedulerServiceTests
{
    private static readonly TimeSpan Step = TimeSpan.FromSeconds(30);

    private readonly IScheduleRuleRepository _schedules = Substitute.For<IScheduleRuleRepository>();
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly IFrigateConfigApplier _frigateConfig = Substitute.For<IFrigateConfigApplier>();

    public PrivacySchedulerServiceTests()
    {
        _frigateConfig.ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>())
            .Returns(new FrigateConfigApplyResult(true, "ok", "frigate.yml"));
    }

    private PrivacySchedulerService CreateSut(FakeTimeProvider time) => new(
        BackgroundLoop.Scopes(services => services
            .AddSingleton(_schedules)
            .AddSingleton(_cameras)
            .AddSingleton(new ToggleCameraPrivacyModeUseCase(_cameras, _bindings, _registry, _frigateConfig, Substitute.For<IPtzPresetRepository>(), new PtzManagedPositions(TimeProvider.System, NullLogger<PtzManagedPositions>.Instance), Substitute.For<ILiveStreamRelay>()))),
        TimeZoneInfo.Utc,
        time,
        NullLogger<PrivacySchedulerService>.Instance);

    // 2026-09-23 is a Wednesday.
    private static ScheduleRule WednesdayMorning(params string[] cameraIds) => new()
    {
        Kind = ScheduleRuleKind.Privacy,
        DaysOfWeek = "[3]",
        StartTime = "08:00",
        EndTime = "12:00",
        Targets = [.. cameraIds.Select(id => new ScheduleRuleTarget { TargetId = id })],
    };

    private Camera KnownCamera(bool privacyActive = false, PrivacyModeSource? source = null)
    {
        var camera = new Camera
        {
            Id = "cam1",
            Slug = "cam1",
            FrigateCameraName = "cam1",
            DisplayName = "Salon",
            Host = "192.168.1.10",
            PrivacyModeActive = privacyActive,
            PrivacyModeSource = source,
        };
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([camera]);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        return camera;
    }

    private TaskCompletionSource<DateTimeOffset> SignalOnUpdate(TimeProvider time)
    {
        var updated = new TaskCompletionSource<DateTimeOffset>(TaskCreationOptions.RunContinuationsAsynchronously);
        _cameras.UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                updated.TrySetResult(time.GetUtcNow());
                return Task.CompletedTask;
            });
        return updated;
    }

    [Fact]
    public async Task ExecuteAsync_ShouldActivatePrivacy_WhenTheCameraIsInsideAScheduledWindow()
    {
        // Arrange
        var time = BackgroundLoop.ClockAt("2026-09-23T10:30:00+00:00");
        var camera = KnownCamera();
        _schedules.GetByKindAsync(ScheduleRuleKind.Privacy, Arg.Any<CancellationToken>()).Returns([WednesdayMorning("cam1")]);
        var updated = SignalOnUpdate(time);
        var sut = CreateSut(time);

        // Act
        await sut.StartAsync(CancellationToken.None);
        await updated.Task.ObservedAsync();
        await sut.StopAsync(CancellationToken.None);

        // Assert
        Assert.True(camera.PrivacyModeActive);
        Assert.Equal(PrivacyModeSource.Schedule, camera.PrivacyModeSource);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldActivatePrivacy_WhenTheNightStartedTheDayBefore()
    {
        // Arrange: Thursday 02:00, inside Wednesday's night.
        var time = BackgroundLoop.ClockAt("2026-09-24T02:00:00+00:00");
        var camera = KnownCamera();
        var wednesdayNight = WednesdayMorning("cam1");
        wednesdayNight.StartTime = "22:00";
        wednesdayNight.EndTime = "06:00";
        _schedules.GetByKindAsync(ScheduleRuleKind.Privacy, Arg.Any<CancellationToken>()).Returns([wednesdayNight]);
        var updated = SignalOnUpdate(time);
        var sut = CreateSut(time);

        // Act
        await sut.StartAsync(CancellationToken.None);
        await updated.Task.ObservedAsync();
        await sut.StopAsync(CancellationToken.None);

        // Assert
        Assert.True(camera.PrivacyModeActive);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldStillApplyTheScheduleToTheOthers_WhenOneCameraFails()
    {
        var time = BackgroundLoop.ClockAt("2026-09-23T10:30:00+00:00");
        var broken = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "Salon", Host = "192.168.1.10" };
        var healthy = new Camera { Id = "cam2", Slug = "cam2", FrigateCameraName = "cam2", DisplayName = "Entree", Host = "192.168.1.11" };
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([broken, healthy]);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns<Camera?>(_ => throw new InvalidOperationException("database busy"));
        _cameras.GetByIdAsync("cam2", Arg.Any<CancellationToken>()).Returns(healthy);
        _schedules.GetByKindAsync(ScheduleRuleKind.Privacy, Arg.Any<CancellationToken>()).Returns([WednesdayMorning("cam1"), WednesdayMorning("cam2")]);
        var updated = SignalOnUpdate(time);
        var sut = CreateSut(time);

        await sut.StartAsync(CancellationToken.None);
        await updated.Task.ObservedAsync();
        await sut.StopAsync(CancellationToken.None);

        Assert.True(healthy.PrivacyModeActive);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldCutEveryTargetedCamera_WhenOneRuleTargetsSeveral()
    {
        // Arrange
        var time = BackgroundLoop.ClockAt("2026-09-23T10:30:00+00:00");
        var salon = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "Salon", Host = "192.168.1.10" };
        var entree = new Camera { Id = "cam2", Slug = "cam2", FrigateCameraName = "cam2", DisplayName = "Entree", Host = "192.168.1.11" };
        var jardin = new Camera { Id = "cam3", Slug = "cam3", FrigateCameraName = "cam3", DisplayName = "Jardin", Host = "192.168.1.12" };
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([salon, entree, jardin]);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(salon);
        _cameras.GetByIdAsync("cam2", Arg.Any<CancellationToken>()).Returns(entree);
        _schedules.GetByKindAsync(ScheduleRuleKind.Privacy, Arg.Any<CancellationToken>()).Returns([WednesdayMorning("cam1", "cam2")]);
        var bothUpdated = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var updates = 0;
        _cameras.UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                if (++updates == 2) bothUpdated.TrySetResult();
                return Task.CompletedTask;
            });
        var sut = CreateSut(time);

        // Act
        await sut.StartAsync(CancellationToken.None);
        await bothUpdated.Task.ObservedAsync();
        await sut.StopAsync(CancellationToken.None);

        // Assert
        Assert.Equal((true, true, false), (salon.PrivacyModeActive, entree.PrivacyModeActive, jardin.PrivacyModeActive));
    }

    [Fact]
    public async Task ExecuteAsync_ShouldActivatePrivacy_WhenTheWindowOpensWhileRunning()
    {
        // Arrange
        var time = BackgroundLoop.ClockAt("2026-09-23T07:59:30+00:00");
        var camera = KnownCamera();
        _schedules.GetByKindAsync(ScheduleRuleKind.Privacy, Arg.Any<CancellationToken>()).Returns([WednesdayMorning("cam1")]);
        var updated = SignalOnUpdate(time);
        var sut = CreateSut(time);

        // Act
        await sut.StartAsync(CancellationToken.None);
        await time.AdvanceUntilAsync(updated.Task, Step);
        await sut.StopAsync(CancellationToken.None);

        // Assert
        Assert.True(camera.PrivacyModeActive);
        Assert.True(await updated.Task >= DateTimeOffset.Parse("2026-09-23T08:00:00+00:00", CultureInfo.InvariantCulture));
    }

    [Fact]
    public async Task ExecuteAsync_ShouldLeaveAManualActivationAlone_WhenAScheduleWindowIsOpen()
    {
        // Arrange
        var time = BackgroundLoop.ClockAt("2026-09-23T10:30:00+00:00");
        var camera = KnownCamera(privacyActive: true, source: PrivacyModeSource.Manual);
        var secondPass = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var passes = 0;
        _schedules.GetByKindAsync(ScheduleRuleKind.Privacy, Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (++passes == 2) secondPass.TrySetResult();
            return Task.FromResult<IReadOnlyList<ScheduleRule>>([WednesdayMorning("cam1")]);
        });
        var sut = CreateSut(time);

        // Act
        await sut.StartAsync(CancellationToken.None);
        await time.AdvanceUntilAsync(secondPass.Task, Step);
        await sut.StopAsync(CancellationToken.None);

        // Assert
        Assert.Equal(PrivacyModeSource.Manual, camera.PrivacyModeSource);
        await _cameras.DidNotReceive().UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldLiftPrivacy_WhenTheScheduleWindowHasEnded()
    {
        // Arrange
        var time = BackgroundLoop.ClockAt("2026-09-23T12:30:00+00:00");
        var camera = KnownCamera(privacyActive: true, source: PrivacyModeSource.Schedule);
        _schedules.GetByKindAsync(ScheduleRuleKind.Privacy, Arg.Any<CancellationToken>()).Returns([WednesdayMorning("cam1")]);
        var updated = SignalOnUpdate(time);
        var sut = CreateSut(time);

        // Act
        await sut.StartAsync(CancellationToken.None);
        await updated.Task.ObservedAsync();
        await sut.StopAsync(CancellationToken.None);

        // Assert
        Assert.False(camera.PrivacyModeActive);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepEvaluating_WhenReadingTheSchedulesFailsOnce()
    {
        // Arrange
        var time = BackgroundLoop.ClockAt("2026-09-23T10:30:00+00:00");
        var camera = KnownCamera();
        _schedules.GetByKindAsync(ScheduleRuleKind.Privacy, Arg.Any<CancellationToken>())
            .Returns(
                _ => throw new InvalidOperationException("database is locked"),
                _ => Task.FromResult<IReadOnlyList<ScheduleRule>>([WednesdayMorning("cam1")]));
        var updated = SignalOnUpdate(time);
        var sut = CreateSut(time);

        // Act
        await sut.StartAsync(CancellationToken.None);
        await time.AdvanceUntilAsync(updated.Task, Step);
        await sut.StopAsync(CancellationToken.None);

        // Assert
        Assert.True(camera.PrivacyModeActive);
    }

    [Fact]
    public async Task StopAsync_ShouldEndTheLoop_WhenTheHostShutsDown()
    {
        // Arrange
        var time = BackgroundLoop.ClockAt("2026-09-23T10:30:00+00:00");
        KnownCamera();
        _schedules.GetByKindAsync(ScheduleRuleKind.Privacy, Arg.Any<CancellationToken>()).Returns([]);
        var sut = CreateSut(time);
        await sut.StartAsync(CancellationToken.None);

        // Act
        await sut.StopWithinGuardAsync();

        // Assert
        Assert.True(sut.ExecuteTask!.IsCompleted);
        Assert.False(sut.ExecuteTask.IsFaulted);
    }
}
