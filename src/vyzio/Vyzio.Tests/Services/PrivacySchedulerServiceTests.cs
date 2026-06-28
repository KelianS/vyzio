using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.Services;

public class PrivacySchedulerServiceTests
{
    private readonly ICameraPrivacyRepository _schedules = Substitute.For<ICameraPrivacyRepository>();
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly IVendorCameraAdapterFactory _adapterFactory = Substitute.For<IVendorCameraAdapterFactory>();
    private readonly IFrigateConfigApplier _frigateConfig = Substitute.For<IFrigateConfigApplier>();

    public PrivacySchedulerServiceTests()
    {
        var adapter = Substitute.For<IVendorCameraAdapter>();
        adapter.SupportsPrivacyModeAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>()).Returns(false);
        _adapterFactory.Resolve(Arg.Any<Camera>()).Returns(adapter);
        _frigateConfig.ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>())
            .Returns(new FrigateConfigApplyResult(true, "ok", "frigate.yml"));
    }

    private PrivacySchedulerService MakeService()
    {
        var toggleUseCase = new ToggleCameraPrivacyModeUseCase(
            _cameras, _adapterFactory, _frigateConfig);

        var provider = Substitute.For<IServiceProvider>();
        provider.GetService(typeof(ICameraPrivacyRepository)).Returns(_schedules);
        provider.GetService(typeof(ICameraRepository)).Returns(_cameras);
        provider.GetService(typeof(ToggleCameraPrivacyModeUseCase)).Returns(toggleUseCase);

        var scope = Substitute.For<IServiceScope>();
        scope.ServiceProvider.Returns(provider);

        var scopeFactory = Substitute.For<IServiceScopeFactory>();
        scopeFactory.CreateScope().Returns(scope);

        return new PrivacySchedulerService(
            scopeFactory,
            TimeZoneInfo.Utc,
            NullLogger<PrivacySchedulerService>.Instance);
    }

    // Schedule that is always within the active window (avoids clock dependency in tests)
    private static CameraPrivacySchedule AlwaysActiveSchedule(string cameraId) => new()
    {
        CameraId = cameraId,
        DaysOfWeek = "[0,1,2,3,4,5,6]",
        StartTime = "00:00",
        EndTime = "23:59",
        Enabled = true,
    };

    private static Camera MakeCamera(string id, bool privacyActive = false, string? source = null) => new()
    {
        Id = id,
        Slug = id,
        DisplayName = id,
        Host = "192.168.1.10",
        Port = 554,
        PrivacyModeActive = privacyActive,
        PrivacyModeSource = source,
    };

    [Fact]
    public async Task Evaluates_schedule_and_activates_camera_within_window()
    {
        var camera = MakeCamera("cam1", privacyActive: false);
        _schedules.GetAllActiveSchedulesAsync(Arg.Any<CancellationToken>())
            .Returns([AlwaysActiveSchedule("cam1")]);
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([camera]);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);

        var activated = new TaskCompletionSource();
        _cameras.UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>())
            .Returns(ci => { activated.TrySetResult(); return Task.CompletedTask; });

        var sut = MakeService();
        await sut.StartAsync(CancellationToken.None);
        await activated.Task.WaitAsync(TimeSpan.FromSeconds(5));
        await sut.StopAsync(CancellationToken.None);

        await _cameras.Received().UpdateAsync(
            Arg.Is<Camera>(c => c.PrivacyModeActive && c.PrivacyModeSource == "schedule"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Manual_privacy_mode_is_not_overridden_by_scheduler()
    {
        var camera = MakeCamera("cam1", privacyActive: true, source: "manual");
        _schedules.GetAllActiveSchedulesAsync(Arg.Any<CancellationToken>())
            .Returns([AlwaysActiveSchedule("cam1")]);

        var evaluated = new TaskCompletionSource();
        _cameras.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns(ci => { evaluated.TrySetResult(); return Task.FromResult<IReadOnlyList<Camera>>([camera]); });

        var sut = MakeService();
        await sut.StartAsync(CancellationToken.None);
        await evaluated.Task.WaitAsync(TimeSpan.FromSeconds(5));
        await Task.Delay(50); // allow per-camera loop to complete after GetAllAsync returns
        await sut.StopAsync(CancellationToken.None);

        await _cameras.DidNotReceive().UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Deactivates_camera_when_schedule_window_ends()
    {
        // Camera was activated by a schedule, and now no schedule is active
        var camera = MakeCamera("cam1", privacyActive: true, source: "schedule");
        _schedules.GetAllActiveSchedulesAsync(Arg.Any<CancellationToken>())
            .Returns(Array.Empty<CameraPrivacySchedule>());
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([camera]);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);

        var deactivated = new TaskCompletionSource();
        _cameras.UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>())
            .Returns(ci => { deactivated.TrySetResult(); return Task.CompletedTask; });

        var sut = MakeService();
        await sut.StartAsync(CancellationToken.None);
        await deactivated.Task.WaitAsync(TimeSpan.FromSeconds(5));
        await sut.StopAsync(CancellationToken.None);

        await _cameras.Received().UpdateAsync(
            Arg.Is<Camera>(c => !c.PrivacyModeActive),
            Arg.Any<CancellationToken>());
    }
}
