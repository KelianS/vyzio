using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class CameraPrivacyScheduleUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraPrivacyRepository _schedules = Substitute.For<ICameraPrivacyRepository>();

    public CameraPrivacyScheduleUseCaseTests()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(new Camera
        {
            Id = "cam1",
            Slug = "cam1",
            FrigateCameraName = "cam1",
            DisplayName = "cam1",
            Host = "192.168.1.10",
            Port = 554,
        });
    }

    private CreateCameraPrivacyScheduleUseCase Create() => new(_cameras, _schedules);

    private static CameraPrivacySchedule Saved() => new()
    {
        CameraId = "cam1",
        DaysOfWeek = "[3]",
        StartTime = "08:00",
        EndTime = "12:00",
    };

    [Fact]
    public async Task ExecuteAsync_ShouldSaveTheRange_WhenItCrossesMidnight()
    {
        var dto = await Create().ExecuteAsync("cam1", new CreatePrivacyScheduleRequest([1, 2, 3, 4, 5], "22:00", "06:00"));

        Assert.NotNull(dto);
        await _schedules.Received(1).AddScheduleAsync(
            Arg.Is<CameraPrivacySchedule>(s => s.StartTime == "22:00" && s.EndTime == "06:00"), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(new[] { 1 }, "08:00", "08:00", PrivacyScheduleRefusal.EmptyRange)]
    [InlineData(new[] { 1 }, "8h", "12:00", PrivacyScheduleRefusal.InvalidTime)]
    [InlineData(new[] { 1 }, "08:00", "25:00", PrivacyScheduleRefusal.InvalidTime)]
    [InlineData(new int[0], "08:00", "12:00", PrivacyScheduleRefusal.NoDay)]
    [InlineData(new[] { 7 }, "08:00", "12:00", PrivacyScheduleRefusal.NoDay)]
    public async Task ExecuteAsync_ShouldRefuseWithItsCodeAndSaveNothing_WhenTheScheduleCannotBeKept(
        int[] days, string start, string end, PrivacyScheduleRefusal expected)
    {
        var refusal = await Assert.ThrowsAsync<InvalidPrivacyScheduleException>(
            () => Create().ExecuteAsync("cam1", new CreatePrivacyScheduleRequest(days, start, end)));

        Assert.Equal(expected, refusal.Refusal);
        await _schedules.DidNotReceive().AddScheduleAsync(Arg.Any<CameraPrivacySchedule>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldMoveTheEndPastMidnight_WhenUpdatedToANightRange()
    {
        var schedule = Saved();
        _schedules.GetScheduleByIdAsync("s1", Arg.Any<CancellationToken>()).Returns(schedule);

        await new UpdateCameraPrivacyScheduleUseCase(_schedules)
            .ExecuteAsync("s1", new UpdatePrivacyScheduleRequest(null, "22:00", "06:00", null));

        Assert.Equal(("22:00", "06:00"), (schedule.StartTime, schedule.EndTime));
        await _schedules.Received(1).UpdateScheduleAsync(schedule, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRefuseAndChangeNothing_WhenAnUpdateEmptiesTheRange()
    {
        var schedule = Saved();
        _schedules.GetScheduleByIdAsync("s1", Arg.Any<CancellationToken>()).Returns(schedule);

        var refusal = await Assert.ThrowsAsync<InvalidPrivacyScheduleException>(
            () => new UpdateCameraPrivacyScheduleUseCase(_schedules)
                .ExecuteAsync("s1", new UpdatePrivacyScheduleRequest([1], "12:00", null, null)));

        Assert.Equal(PrivacyScheduleRefusal.EmptyRange, refusal.Refusal);
        Assert.Equal(("[3]", "08:00"), (schedule.DaysOfWeek, schedule.StartTime));
        await _schedules.DidNotReceive().UpdateScheduleAsync(Arg.Any<CameraPrivacySchedule>(), Arg.Any<CancellationToken>());
    }
}
