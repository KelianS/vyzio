using NSubstitute;
using Vyzio.Application.UseCases.Monitoring;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class GetSystemStatsUseCaseTests
{
    private readonly IFrigateStatsProvider _statsProvider = Substitute.For<IFrigateStatsProvider>();
    private readonly IFrigateRestartTracker _restartTracker = Substitute.For<IFrigateRestartTracker>();
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly IFrigateDetectorPlanner _detectorPlanner = Substitute.For<IFrigateDetectorPlanner>();
    private readonly IFrigateConfigApplier _configApplier = Substitute.For<IFrigateConfigApplier>();
    private readonly GetSystemStatsUseCase _sut;

    public GetSystemStatsUseCaseTests()
    {
        _sut = new GetSystemStatsUseCase(_statsProvider, _restartTracker, _cameras, _detectorPlanner, _configApplier);
    }

    [Fact]
    public async Task Stats_report_a_configuration_written_but_not_taken_up_yet()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);
        _detectorPlanner.Plan(Arg.Any<int>()).Returns(new FrigateDetectorPlan(FrigateDetectorKind.Cpu, 5, FrigateHwAccel.None));
        _configApplier.HasPendingChanges.Returns(true);

        var result = await _sut.ExecuteAsync();

        Assert.True(result.PendingChanges);
    }

    private static Camera MakeCamera(bool isEnabled = true, string validationState = "validated") => new()
    {
        Slug = "front-door",
        DisplayName = "Front Door",
        Host = "192.168.1.10",
        Port = 554,
        IsEnabled = isEnabled,
        ValidationState = validationState,
    };

    [Fact]
    public async Task Detection_config_is_reported_when_frigate_is_active()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeCamera()]);
        _detectorPlanner.Plan(1).Returns(new FrigateDetectorPlan(FrigateDetectorKind.Cpu, 3, FrigateHwAccel.None));
        _statsProvider.TryGetStatsAsync(Arg.Any<CancellationToken>()).Returns(new FrigateStats(null, []));

        var result = await _sut.ExecuteAsync();

        Assert.Equal("active", result.Status);
        Assert.Equal("cpu", result.Detection.Hardware);
        Assert.Equal(3, result.Detection.TargetFps);
    }

    [Fact]
    public async Task Detection_config_is_still_reported_when_frigate_is_unavailable()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeCamera()]);
        _detectorPlanner.Plan(1).Returns(new FrigateDetectorPlan(FrigateDetectorKind.EdgeTpu, 5, FrigateHwAccel.None));
        _statsProvider.TryGetStatsAsync(Arg.Any<CancellationToken>()).Returns((FrigateStats?)null);
        _restartTracker.IsRestarting.Returns(false);

        var result = await _sut.ExecuteAsync();

        Assert.Equal("unavailable", result.Status);
        Assert.Equal("edge_tpu", result.Detection.Hardware);
        Assert.Equal(5, result.Detection.TargetFps);
    }

    [Fact]
    public async Task Detection_config_only_counts_enabled_and_validated_cameras()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns(
        [
            MakeCamera(),
            MakeCamera(isEnabled: false),
            MakeCamera(validationState: "pending"),
        ]);
        _detectorPlanner.Plan(1).Returns(new FrigateDetectorPlan(FrigateDetectorKind.Cpu, 4, FrigateHwAccel.None));
        _statsProvider.TryGetStatsAsync(Arg.Any<CancellationToken>()).Returns(new FrigateStats(null, []));

        var result = await _sut.ExecuteAsync();

        Assert.Equal(4, result.Detection.TargetFps);
        _detectorPlanner.Received(1).Plan(1);
    }
}
