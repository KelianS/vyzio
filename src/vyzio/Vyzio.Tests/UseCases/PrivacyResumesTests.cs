using Microsoft.Extensions.Time.Testing;
using Vyzio.Application.DTOs.Cameras;
using Vyzio.Application.DTOs.Scheduling;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;

namespace Vyzio.Tests.UseCases;

public class PrivacyResumesTests
{
    // 2026-09-23 is a Wednesday, inside the morning range below.
    private readonly FakeTimeProvider _time = new(new DateTimeOffset(2026, 9, 23, 10, 30, 0, TimeSpan.Zero));

    private static ScheduleRule WednesdayMorning()
    {
        var rule = new ScheduleRule { Kind = ScheduleRuleKind.Privacy, DaysOfWeek = "[3]", StartTime = "08:00", EndTime = "12:00" };
        rule.ReplaceTargets(["cam1"]);
        return rule;
    }

    [Fact]
    public void StateOf_ShouldAnswerTheEndOfTheRange_WhenTheCameraIsResumedInsideIt()
    {
        // Arrange
        var sut = new PrivacyResumes(TimeZoneInfo.Utc, _time);
        sut.Resume("cam1", [WednesdayMorning()]);

        // Act
        var state = sut.StateOf("cam1", [WednesdayMorning()]);

        // Assert
        Assert.Equal(new PrivacyResumeDto(new HouseClockDto(3, "12:00")), state);
    }

    [Fact]
    public void StateOf_ShouldAnswerNull_WhenTheRangeHasEnded()
    {
        // Arrange
        var sut = new PrivacyResumes(TimeZoneInfo.Utc, _time);
        sut.Resume("cam1", [WednesdayMorning()]);
        _time.Advance(TimeSpan.FromHours(2));

        // Act
        var state = sut.StateOf("cam1", [WednesdayMorning()]);

        // Assert
        Assert.Null(state);
    }

    [Fact]
    public void StateOf_ShouldAnswerNull_WhenTheCameraWasNotResumed()
    {
        // Arrange
        var sut = new PrivacyResumes(TimeZoneInfo.Utc, _time);

        // Act
        var state = sut.StateOf("cam1", [WednesdayMorning()]);

        // Assert
        Assert.Null(state);
    }

    [Fact]
    public void Holds_ShouldAnswerFalse_WhenTheRangeEndedWithoutAnyPassInBetween()
    {
        // Arrange
        var sut = new PrivacyResumes(TimeZoneInfo.Utc, _time);
        sut.Resume("cam1", [WednesdayMorning()]);
        _time.Advance(TimeSpan.FromHours(2));

        // Act
        var holds = sut.Holds("cam1");

        // Assert
        Assert.False(holds);
    }
}
