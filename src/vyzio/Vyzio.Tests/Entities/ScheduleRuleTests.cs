using System.Globalization;
using Vyzio.Core.Entities;

namespace Vyzio.Tests.Entities;

public class ScheduleRuleTests
{
    // 2026-09-20 is a Sunday, so its offset in days is the day of week (0 = Sunday, 3 = Wednesday).
    private static readonly DateTimeOffset Sunday = new(2026, 9, 20, 0, 0, 0, TimeSpan.Zero);

    private static DateTimeOffset At(int dayOfWeek, string time) =>
        Sunday.AddDays(dayOfWeek).Add(TimeSpan.Parse(time, CultureInfo.InvariantCulture));

    private static ScheduleRule Range(string days, string start, string end) => new()
    {
        Kind = ScheduleRuleKind.Privacy,
        DaysOfWeek = days,
        StartTime = start,
        EndTime = end,
    };

    [Theory]
    [InlineData(3, "22:00", true)]
    [InlineData(3, "23:59", true)]
    [InlineData(4, "00:00", true)]
    [InlineData(4, "05:59", true)]
    [InlineData(4, "06:00", false)]
    [InlineData(3, "21:59", false)]
    [InlineData(3, "05:00", false)]
    [InlineData(4, "22:30", false)]
    public void Covers_ShouldHoldTheNightThatStartsOnTheChosenDay_WhenTheRangeCrossesMidnight(int day, string time, bool expected)
    {
        // Arrange
        var night = Range("[3]", "22:00", "06:00");

        // Act
        var covered = night.Covers(At(day, time));

        // Assert
        Assert.Equal(expected, covered);
    }

    [Fact]
    public void Covers_ShouldReachIntoSunday_WhenASaturdayNightCrossesMidnight()
    {
        // Arrange
        var saturdayNight = Range("[6]", "22:00", "06:00");

        // Act
        var covered = saturdayNight.Covers(At(0, "02:00"));

        // Assert
        Assert.True(covered);
    }

    [Theory]
    [InlineData(3, "08:00", true)]
    [InlineData(3, "11:59", true)]
    [InlineData(3, "12:00", false)]
    [InlineData(3, "07:59", false)]
    [InlineData(4, "09:00", false)]
    public void Covers_ShouldHoldOnlyTheChosenDay_WhenTheRangeStaysWithinIt(int day, string time, bool expected)
    {
        // Arrange
        var morning = Range("[3]", "08:00", "12:00");

        // Act
        var covered = morning.Covers(At(day, time));

        // Assert
        Assert.Equal(expected, covered);
    }

    [Fact]
    public void Covers_ShouldHoldNothing_WhenStartAndEndAreTheSame()
    {
        // Arrange
        var empty = Range("[3]", "08:00", "08:00");

        // Act
        var covered = empty.Covers(At(3, "08:00"));

        // Assert
        Assert.False(covered);
    }

    [Theory]
    [InlineData(new[] { 1 }, "08:00", "08:00", ScheduleRuleRefusal.EmptyRange)]
    [InlineData(new[] { 1 }, "8h", "12:00", ScheduleRuleRefusal.InvalidTime)]
    [InlineData(new[] { 1 }, "08:00", "25:00", ScheduleRuleRefusal.InvalidTime)]
    [InlineData(new int[0], "08:00", "12:00", ScheduleRuleRefusal.NoDay)]
    [InlineData(new[] { 7 }, "08:00", "12:00", ScheduleRuleRefusal.NoDay)]
    public void CheckRange_ShouldNameWhatToChange_WhenTheRangeCannotBeKept(int[] days, string start, string end, ScheduleRuleRefusal expected)
    {
        // Act
        var refusal = ScheduleRule.CheckRange(days, start, end);

        // Assert
        Assert.Equal(expected, refusal);
    }

    [Fact]
    public void ReplaceTargets_ShouldKeepTheTargetsStillWantedAndAddTheNewOnes_WhenTheSetChanges()
    {
        // Arrange
        var rule = Range("[3]", "08:00", "12:00");
        rule.ReplaceTargets(["cam1", "cam2"]);
        var kept = rule.Targets[0];

        // Act
        rule.ReplaceTargets(["cam1", "cam3"]);

        // Assert
        Assert.Equal(["cam1", "cam3"], rule.GetTargetIds());
        Assert.Same(kept, rule.Targets[0]);
    }
}
