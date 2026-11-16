using System.Globalization;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;
using Vyzio.Application.DTOs.Notifications;
using Vyzio.Application.DTOs.Scheduling;
using Vyzio.Application.UseCases.Notifications;
using Vyzio.Application.UseCases.Scheduling;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class SilenceUseCaseTests
{
    private static readonly TimeZoneInfo House = TimeZoneInfo.CreateCustomTimeZone("house", TimeSpan.FromHours(1), "house", "house");

    private readonly INotificationSilenceRepository _silences = Substitute.For<INotificationSilenceRepository>();
    private readonly IScheduleRuleRepository _scheduleRules = Substitute.For<IScheduleRuleRepository>();

    // Monday 2026-11-16, 14:00 in the house.
    private readonly FakeTimeProvider _time = new(At("2026-11-16T13:00Z"));

    public SilenceUseCaseTests()
    {
        _scheduleRules.GetByKindAsync(ScheduleRuleKind.MuteNotifications, Arg.Any<CancellationToken>()).Returns([]);
    }

    private static DateTimeOffset At(string moment) => DateTimeOffset.Parse(moment, CultureInfo.InvariantCulture);

    private GetSilenceUseCase State() => new(_silences, new ScheduleNextChange(_scheduleRules, House), House, _time);

    private StartSilenceUseCase Start() => new(_silences, State(), _time, NullLogger<StartSilenceUseCase>.Instance);

    [Fact]
    public async Task GetSilence_ShouldBeInactive_WhenNoSilenceWasStarted()
    {
        // Arrange & Act
        var silence = await State().ExecuteAsync();

        // Assert
        Assert.Equal(new SilenceDto(false, null, null), silence);
    }

    [Fact]
    public async Task GetSilence_ShouldTellItsEndInTheHouseClock_WhenASilenceIsRunning()
    {
        // Arrange
        _silences.GetAsync(Arg.Any<CancellationToken>())
            .Returns(new NotificationSilence { StartedAt = At("2026-11-16T12:30Z"), Until = At("2026-11-16T15:00Z") });

        // Act
        var silence = await State().ExecuteAsync();

        // Assert
        Assert.True(silence.Active);
        Assert.Equal((At("2026-11-16T15:00Z"), 1, "16:00"), (silence.Until!.At, silence.Until.DayOfWeek, silence.Until.Time));
    }

    [Fact]
    public async Task GetSilence_ShouldBeActiveWithNoEnd_WhenTheSilenceHoldsUntilTheUserEndsIt()
    {
        // Arrange
        _silences.GetAsync(Arg.Any<CancellationToken>())
            .Returns(new NotificationSilence { StartedAt = At("2026-11-09T12:30Z"), Until = null });

        // Act
        var silence = await State().ExecuteAsync();

        // Assert
        Assert.Equal((true, (HouseMomentDto?)null), (silence.Active, silence.Until));
    }

    [Fact]
    public async Task GetSilence_ShouldBeInactive_WhenTheSilenceHasExpired()
    {
        // Arrange
        _silences.GetAsync(Arg.Any<CancellationToken>())
            .Returns(new NotificationSilence { StartedAt = At("2026-11-16T10:00Z"), Until = At("2026-11-16T12:00Z") });

        // Act
        var silence = await State().ExecuteAsync();

        // Assert
        Assert.Equal((false, (HouseMomentDto?)null), (silence.Active, silence.Until));
    }

    [Fact]
    public async Task GetSilence_ShouldOfferTheNextScheduleChange_WhenAMuteRangeExists()
    {
        // Arrange
        _scheduleRules.GetByKindAsync(ScheduleRuleKind.MuteNotifications, Arg.Any<CancellationToken>()).Returns([
            new ScheduleRule
            {
                Kind = ScheduleRuleKind.MuteNotifications,
                DaysOfWeek = "[1]",
                StartTime = "22:00",
                EndTime = "07:00",
                Targets = [new ScheduleRuleTarget { TargetId = "telegram" }],
            },
        ]);

        // Act
        var silence = await State().ExecuteAsync();

        // Assert
        Assert.Equal("22:00", silence.ScheduleNextChange?.Time);
    }

    [Fact]
    public async Task StartSilence_ShouldHoldNotificationsForTheDuration_WhenMinutesAreGiven()
    {
        // Arrange
        _silences.GetAsync(Arg.Any<CancellationToken>())
            .Returns(new NotificationSilence { StartedAt = At("2026-11-16T13:00Z"), Until = At("2026-11-16T13:30Z") });

        // Act
        var result = await Start().ExecuteAsync(new ChosenEndRequest(Minutes: 30));

        // Assert
        await _silences.Received(1).SaveAsync(
            Arg.Is<NotificationSilence>(s => s.StartedAt == At("2026-11-16T13:00Z") && s.Until == At("2026-11-16T13:30Z")),
            Arg.Any<CancellationToken>());
        Assert.Equal("14:30", result.Silence?.Until?.Time);
    }

    [Fact]
    public async Task StartSilence_ShouldHoldNotificationsUntilTheInstant_WhenAnEndIsGiven()
    {
        // Arrange & Act
        await Start().ExecuteAsync(new ChosenEndRequest(Until: At("2026-11-16T21:00Z")));

        // Assert
        await _silences.Received(1).SaveAsync(
            Arg.Is<NotificationSilence>(s => s.Until == At("2026-11-16T21:00Z")), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task StartSilence_ShouldRefuseAndKeepNothing_WhenBothAnEndAndADurationAreGiven()
    {
        // Arrange & Act
        var result = await Start().ExecuteAsync(new ChosenEndRequest(At("2026-11-16T21:00Z"), 30));

        // Assert
        Assert.Equal(ChosenEndRefusal.TwoEnds, result.Refusal);
        await _silences.DidNotReceiveWithAnyArgs().SaveAsync(default!, default);
    }

    [Fact]
    public async Task StartSilence_ShouldHoldNotificationsWithNoEnd_WhenNeitherAnEndNorADurationIsGiven()
    {
        // Arrange & Act
        var result = await Start().ExecuteAsync(new ChosenEndRequest());

        // Assert
        Assert.Null(result.Refusal);
        await _silences.Received(1).SaveAsync(
            Arg.Is<NotificationSilence>(s => s.StartedAt == At("2026-11-16T13:00Z") && s.Until == null), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task StartSilence_ShouldRefuse_WhenTheEndIsAlreadyPast()
    {
        // Arrange & Act
        var result = await Start().ExecuteAsync(new ChosenEndRequest(Until: At("2026-11-16T12:00Z")));

        // Assert
        Assert.Equal(ChosenEndRefusal.EndNotAhead, result.Refusal);
    }

    [Fact]
    public async Task StartSilence_ShouldRefuse_WhenTheDurationExceedsAWeek()
    {
        // Arrange & Act
        var result = await Start().ExecuteAsync(new ChosenEndRequest(Minutes: int.MaxValue));

        // Assert
        Assert.Equal(ChosenEndRefusal.TooLong, result.Refusal);
    }

    [Fact]
    public async Task StopSilence_ShouldClearTheSilence_WhenTheUserEndsIt()
    {
        // Arrange
        var stop = new StopSilenceUseCase(_silences, State(), NullLogger<StopSilenceUseCase>.Instance);

        // Act
        var silence = await stop.ExecuteAsync();

        // Assert
        await _silences.Received(1).ClearAsync(Arg.Any<CancellationToken>());
        Assert.False(silence.Active);
    }
}
