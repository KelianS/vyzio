using System.Globalization;
using Vyzio.Core.Entities;

namespace Vyzio.Tests.Entities;

public class CameraPrivacyScheduleTests
{
    // Days: 0 = Sunday, 3 = Wednesday, 4 = Thursday.
    private static CameraPrivacySchedule Range(string days, string start, string end) => new()
    {
        CameraId = "cam1",
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
        var night = Range("[3]", "22:00", "06:00");

        Assert.Equal(expected, night.Covers(day, TimeSpan.Parse(time, CultureInfo.InvariantCulture)));
    }

    [Fact]
    public void Covers_ShouldReachIntoSunday_WhenASaturdayNightCrossesMidnight()
    {
        var saturdayNight = Range("[6]", "22:00", "06:00");

        Assert.True(saturdayNight.Covers(0, TimeSpan.FromHours(2)));
    }

    [Theory]
    [InlineData("08:00", true)]
    [InlineData("11:59", true)]
    [InlineData("12:00", false)]
    [InlineData("07:59", false)]
    public void Covers_ShouldHoldOnlyTheChosenDay_WhenTheRangeStaysWithinIt(string time, bool expected)
    {
        var morning = Range("[3]", "08:00", "12:00");

        Assert.Equal(expected, morning.Covers(3, TimeSpan.Parse(time, CultureInfo.InvariantCulture)));
        Assert.False(morning.Covers(4, TimeSpan.Parse(time, CultureInfo.InvariantCulture)));
    }

    [Fact]
    public void Covers_ShouldHoldNothing_WhenStartAndEndAreTheSame()
    {
        Assert.False(Range("[3]", "08:00", "08:00").Covers(3, TimeSpan.FromHours(8)));
    }
}
