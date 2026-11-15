using System.Globalization;
using Vyzio.Application.UseCases.Scheduling;
using Vyzio.Core.Entities;

namespace Vyzio.Tests.UseCases;

public class ScheduleChangesTests
{
    // A house two hours ahead of UTC with no daylight saving, so every expected instant is written plainly.
    private static readonly TimeZoneInfo House = TimeZoneInfo.CreateCustomTimeZone("house", TimeSpan.FromHours(2), "house", "house");

    private static ScheduleRule Mute(string id, string days, string start, string end) => new()
    {
        Id = id,
        Kind = ScheduleRuleKind.MuteNotifications,
        DaysOfWeek = days,
        StartTime = start,
        EndTime = end,
        Targets = [new ScheduleRuleTarget { RuleId = id, TargetId = "telegram" }],
    };

    private static DateTimeOffset At(string houseMoment)
        => DateTimeOffset.Parse(houseMoment, CultureInfo.InvariantCulture);

    [Fact]
    public void Next_ShouldBeAbsent_WhenNoMuteRangeExists()
    {
        // Arrange & Act
        var next = ScheduleChanges.Next([], At("2026-11-16T15:00+02:00"), House);

        // Assert
        Assert.Null(next);
    }

    [Fact]
    public void Next_ShouldBeTheRangeStart_WhenTheRangeIsStillAheadToday()
    {
        // Arrange
        var evenings = Mute("evening", "[1]", "22:00", "07:00");

        // Act
        var next = ScheduleChanges.Next([evenings], At("2026-11-16T15:00+02:00"), House);

        // Assert
        Assert.Equal(At("2026-11-16T22:00+02:00"), next);
    }

    [Fact]
    public void Next_ShouldBeTheNextMorning_WhenARangeStartedTheEveningBeforeCoversNow()
    {
        // Arrange
        var mondayNight = Mute("night", "[1]", "22:00", "07:00");

        // Act
        var next = ScheduleChanges.Next([mondayNight], At("2026-11-17T01:00+02:00"), House);

        // Assert
        Assert.Equal(At("2026-11-17T07:00+02:00"), next);
    }

    [Fact]
    public void Next_ShouldCrossMidnight_WhenTheRangeEndsTheNextDay()
    {
        // Arrange
        var mondayNight = Mute("night", "[1]", "22:00", "07:00");

        // Act
        var next = ScheduleChanges.Next([mondayNight], At("2026-11-16T23:30+02:00"), House);

        // Assert
        Assert.Equal(At("2026-11-17T07:00+02:00"), next);
    }

    [Fact]
    public void Next_ShouldWrapToNextWeek_WhenTheOnlyRangeOfTheWeekIsOver()
    {
        // Arrange
        var mondayMorning = Mute("morning", "[1]", "10:00", "11:00");

        // Act
        var next = ScheduleChanges.Next([mondayMorning], At("2026-11-16T12:00+02:00"), House);

        // Assert
        Assert.Equal(At("2026-11-23T10:00+02:00"), next);
    }

    [Fact]
    public void Next_ShouldEndOnSunday_WhenASaturdayNightRangeCoversNow()
    {
        // Arrange
        var saturdayNight = Mute("saturday", "[6]", "22:00", "02:00");

        // Act
        var next = ScheduleChanges.Next([saturdayNight], At("2026-11-22T00:30+02:00"), House);

        // Assert
        Assert.Equal(At("2026-11-22T02:00+02:00"), next);
    }

    [Fact]
    public void Next_ShouldBeTheFirstEnd_WhenTwoOverlappingRangesCoverNow()
    {
        // Arrange
        var morning = Mute("morning", "[1]", "08:00", "12:00");
        var midday = Mute("midday", "[1]", "10:00", "14:00");

        // Act
        var next = ScheduleChanges.Next([morning, midday], At("2026-11-16T11:00+02:00"), House);

        // Assert
        Assert.Equal(At("2026-11-16T12:00+02:00"), next);
    }

    [Fact]
    public void Next_ShouldBeTheFollowingBoundary_WhenNowIsExactlyARangeStart()
    {
        // Arrange
        var mondayMorning = Mute("morning", "[1]", "10:00", "11:00");

        // Act
        var next = ScheduleChanges.Next([mondayMorning], At("2026-11-16T10:00+02:00"), House);

        // Assert
        Assert.Equal(At("2026-11-16T11:00+02:00"), next);
    }

    [Fact]
    public void Next_ShouldReadTheHouseClock_WhenNowIsGivenInUtc()
    {
        // Arrange
        var mondayMorning = Mute("morning", "[1]", "08:00", "09:00");

        // Act
        var next = ScheduleChanges.Next([mondayMorning], At("2026-11-16T05:00Z"), House);

        // Assert
        Assert.Equal(At("2026-11-16T06:00Z"), next);
    }
}
