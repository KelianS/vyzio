using System.Globalization;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;
using Vyzio.Application.DTOs.Scheduling;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Application.UseCases.Scheduling;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class CamerasCutUseCaseTests
{
    private static readonly TimeZoneInfo House = TimeZoneInfo.CreateCustomTimeZone("house", TimeSpan.FromHours(1), "house", "house");

    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly IScheduleRuleRepository _scheduleRules = Substitute.For<IScheduleRuleRepository>();

    // Monday 2026-11-16, 14:00:20 in the house.
    private readonly FakeTimeProvider _time = new(At("2026-11-16T13:00:20Z"));

    private readonly Camera _salon = new() { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "Salon", Host = "192.168.1.10" };
    private readonly Camera _garage = new() { Id = "cam2", Slug = "cam2", FrigateCameraName = "cam2", DisplayName = "Garage", Host = "192.168.1.11" };

    public CamerasCutUseCaseTests()
    {
        _scheduleRules.GetByKindAsync(Arg.Any<ScheduleRuleKind>(), Arg.Any<CancellationToken>()).Returns([]);
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([_salon, _garage]);
    }

    private static DateTimeOffset At(string moment) => DateTimeOffset.Parse(moment, CultureInfo.InvariantCulture);

    private CutCamerasUseCase Cut()
    {
        var resumes = new PrivacyResumes(House, _time);
        var bindings = Substitute.For<ICameraCapabilityBindingRepository>();
        var frigateConfig = Substitute.For<IFrigateConfigApplier>();
        var batch = new BatchToggleCameraPrivacyModeUseCase(
            _cameras, bindings, Substitute.For<ICapabilityProviderRegistry>(), frigateConfig, Substitute.For<IPtzPresetRepository>(),
            new PtzManagedPositions(TimeProvider.System, NullLogger<PtzManagedPositions>.Instance), Substitute.For<ILiveStreamRelay>(), _scheduleRules, resumes);
        var list = new GetCamerasUseCase(_cameras, bindings, _scheduleRules, resumes);
        return new CutCamerasUseCase(_cameras, batch, list, _time, NullLogger<CutCamerasUseCase>.Instance);
    }

    [Fact]
    public async Task CutCameras_ShouldCutEveryCameraUntilTheNextWholeMinute_WhenADurationIsChosen()
    {
        // Arrange & Act
        var result = await Cut().ExecuteAsync(new ChosenEndRequest(Minutes: 30));

        // Assert
        Assert.Equal(["14:31", "14:31"], result.Cameras!.Select(camera => camera.PrivacyCutUntil?.Time));
        Assert.Equal((At("2026-11-16T13:31Z"), At("2026-11-16T13:31Z")), (_salon.PrivacyModeUntil, _garage.PrivacyModeUntil));
    }

    [Fact]
    public async Task CutCameras_ShouldCutEveryCameraUntilResumed_WhenNoEndIsChosen()
    {
        // Arrange & Act
        await Cut().ExecuteAsync(new ChosenEndRequest());

        // Assert
        Assert.Equal((true, true, (DateTimeOffset?)null), (_salon.PrivacyModeActive, _garage.PrivacyModeActive, _salon.PrivacyModeUntil));
    }

    [Fact]
    public async Task CutCameras_ShouldRefuseAndCutNothing_WhenTheEndIsBeyondAWeek()
    {
        // Arrange & Act
        var result = await Cut().ExecuteAsync(new ChosenEndRequest(Until: At("2026-11-30T13:00Z")));

        // Assert
        Assert.Equal(ChosenEndRefusal.TooLong, result.Refusal);
        await _cameras.DidNotReceiveWithAnyArgs().UpdateAsync(default!, default);
    }

    [Fact]
    public async Task GetCamerasCut_ShouldOfferTheNextChangeOfThePrivacyRanges_WhenOneExists()
    {
        // Arrange
        _scheduleRules.GetByKindAsync(ScheduleRuleKind.Privacy, Arg.Any<CancellationToken>()).Returns([
            new ScheduleRule
            {
                Kind = ScheduleRuleKind.Privacy,
                DaysOfWeek = "[1]",
                StartTime = "18:00",
                EndTime = "23:00",
                Targets = [new ScheduleRuleTarget { TargetId = "cam1" }],
            },
        ]);
        var sut = new GetCamerasCutUseCase(new ScheduleNextChange(_scheduleRules, House), _time);

        // Act
        var cut = await sut.ExecuteAsync();

        // Assert
        Assert.Equal("18:00", cut.ScheduleNextChange?.Time);
    }
}
