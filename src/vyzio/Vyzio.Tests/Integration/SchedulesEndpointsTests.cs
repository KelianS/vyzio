using System.Net;
using System.Net.Http.Json;
using Vyzio.Application.DTOs.Scheduling;

namespace Vyzio.Tests.Integration;

public class SchedulesEndpointsTests : IClassFixture<CamerasApiFactory>
{
    private static readonly int[] Weekdays = [1, 2, 3, 4, 5];
    private static readonly string[] FrontDoor = ["camera-1"];
    private readonly CamerasApiFactory _factory;

    public SchedulesEndpointsTests(CamerasApiFactory factory)
    {
        _factory = factory;
        _factory.ResetState();
    }

    [Fact]
    public async Task CreateSchedule_ShouldKeepTheNightAndListIt_WhenTheRangeCrossesMidnight()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.PostAsJsonAsync("/api/schedules",
            new { kind = "privacy", targetIds = FrontDoor, daysOfWeek = Weekdays, startTime = "22:00", endTime = "06:00" });

        // Assert
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<ScheduleRuleDto>();
        var listed = await client.GetFromJsonAsync<ScheduleRuleDto[]>("/api/schedules");
        var rule = Assert.Single(listed!, r => r.Id == created!.Id);
        Assert.Equal(("privacy", "camera-1", "06:00"), (rule.Kind, Assert.Single(rule.TargetIds), rule.EndTime));
    }

    [Fact]
    public async Task CreateSchedule_ShouldAnswerARefusalWithItsCode_WhenNoTargetIsChosen()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.PostAsJsonAsync("/api/schedules",
            new { kind = "mute_notifications", targetIds = Array.Empty<string>(), daysOfWeek = Weekdays, startTime = "08:00", endTime = "12:00" });

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("schedule_no_target", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task CreateSchedule_ShouldAnswerARefusalWithItsCode_WhenTheBodyOmitsTheTargets()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.PostAsJsonAsync("/api/schedules",
            new { kind = "privacy", daysOfWeek = Weekdays, startTime = "08:00", endTime = "12:00" });

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("schedule_no_target", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task UpdateSchedule_ShouldAnswerARefusalWithItsCode_WhenTheBodyOmitsTheDays()
    {
        // Arrange
        using var client = _factory.CreateClient();
        var created = await client.PostAsJsonAsync("/api/schedules",
            new { kind = "privacy", targetIds = FrontDoor, daysOfWeek = Weekdays, startTime = "22:00", endTime = "06:00" });
        var rule = await created.Content.ReadFromJsonAsync<ScheduleRuleDto>();

        // Act
        var response = await client.PutAsJsonAsync($"/api/schedules/{rule!.Id}",
            new { targetIds = FrontDoor, startTime = "22:00", endTime = "06:00" });

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("schedule_no_day", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task UpdateSchedule_ShouldAnswerARefusalWithItsCode_WhenTheRangeBecomesEmpty()
    {
        // Arrange
        using var client = _factory.CreateClient();
        var created = await client.PostAsJsonAsync("/api/schedules",
            new { kind = "privacy", targetIds = FrontDoor, daysOfWeek = Weekdays, startTime = "22:00", endTime = "06:00" });
        var rule = await created.Content.ReadFromJsonAsync<ScheduleRuleDto>();

        // Act
        var response = await client.PutAsJsonAsync($"/api/schedules/{rule!.Id}",
            new { targetIds = FrontDoor, daysOfWeek = Weekdays, startTime = "22:00", endTime = "22:00" });

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("schedule_empty_range", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task GetSchedule_ShouldAnswerNotFound_WhenTheRuleDoesNotExist()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/schedules/missing");

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteSchedule_ShouldAnswerNotFound_WhenTheRuleIsAlreadyGone()
    {
        // Arrange
        using var client = _factory.CreateClient();
        var created = await client.PostAsJsonAsync("/api/schedules",
            new { kind = "privacy", targetIds = FrontDoor, daysOfWeek = Weekdays, startTime = "22:00", endTime = "06:00" });
        var rule = await created.Content.ReadFromJsonAsync<ScheduleRuleDto>();
        await client.DeleteAsync($"/api/schedules/{rule!.Id}");

        // Act
        var response = await client.DeleteAsync($"/api/schedules/{rule.Id}");

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetHouseClock_ShouldAnswerADayAndATime_WhenTheHouseClockIsRead()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var clock = await client.GetFromJsonAsync<HouseClockDto>("/api/schedules/clock");

        // Assert
        Assert.InRange(clock!.DayOfWeek, 0, 6);
        Assert.Matches(@"^\d{2}:\d{2}$", clock.Time);
    }
}
