using NSubstitute;
using Vyzio.Application.DTOs.Scheduling;
using Vyzio.Application.UseCases.Scheduling;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Notifications;

namespace Vyzio.Tests.UseCases;

public class ScheduleRuleUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly IScheduleRuleRepository _rules = Substitute.For<IScheduleRuleRepository>();

    public ScheduleRuleUseCaseTests()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([Camera("cam1"), Camera("cam2")]);
    }

    private static Camera Camera(string id) => new()
    {
        Id = id,
        Slug = id,
        FrigateCameraName = id,
        DisplayName = id,
        Host = "192.168.1.10",
        Port = 554,
    };

    private static INotificationChannelSender Sender(NotificationChannel channel)
    {
        var sender = Substitute.For<INotificationChannelSender>();
        sender.Descriptor.Returns(new NotificationChannelDescriptor(
            channel,
            channel.ToString(),
            new ChannelCapabilities(true, true, GroupedMedia: true, Buttons: false, UsefulTextLength: 1024),
            new ChannelTransport([new ChannelCredentialSpec(ChannelCredential.ChatId, false)])));
        return sender;
    }

    private ScheduleRuleValidator Validator() =>
        new(_cameras, new NotificationChannelCatalog([Sender(NotificationChannel.Telegram), Sender(NotificationChannel.Discord)]));

    private CreateScheduleRuleUseCase Create() => new(_rules, Validator());

    private UpdateScheduleRuleUseCase Update() => new(_rules, Validator());

    private static ScheduleRule Saved()
    {
        var rule = new ScheduleRule
        {
            Id = "r1",
            Kind = ScheduleRuleKind.Privacy,
            DaysOfWeek = "[3]",
            StartTime = "08:00",
            EndTime = "12:00",
        };
        rule.ReplaceTargets(["cam1"]);
        return rule;
    }

    [Fact]
    public async Task ExecuteAsync_ShouldSaveOneRuleCarryingEveryTarget_WhenAPrivacyRangeTargetsSeveralCameras()
    {
        // Arrange
        var request = new CreateScheduleRuleRequest("privacy", ["cam1", "cam2"], [1, 2, 3, 4, 5], "22:00", "06:00");

        // Act
        var dto = await Create().ExecuteAsync(request);

        // Assert
        Assert.Equal("privacy", dto.Kind);
        Assert.Equal(["cam1", "cam2"], dto.TargetIds);
        await _rules.Received(1).AddAsync(
            Arg.Is<ScheduleRule>(r => r.Kind == ScheduleRuleKind.Privacy && r.Targets.Count == 2 && r.EndTime == "06:00"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldAcceptTheChannels_WhenANotificationRangeTargetsThem()
    {
        // Arrange
        var request = new CreateScheduleRuleRequest("mute_notifications", ["telegram", "discord"], [0, 6], "09:00", "12:00");

        // Act
        var dto = await Create().ExecuteAsync(request);

        // Assert
        Assert.Equal("mute_notifications", dto.Kind);
    }

#pragma warning disable format // Aligned as a table so each row reads against the others.
    [Theory]
    [InlineData("privacy",            new[] { "cam1" },     new[] { 1 }, "08:00", "08:00", ScheduleRuleRefusal.EmptyRange)]
    [InlineData("privacy",            new[] { "cam1" },     new int[0],  "08:00", "12:00", ScheduleRuleRefusal.NoDay)]
    [InlineData("privacy",            new string[0],        new[] { 1 }, "08:00", "12:00", ScheduleRuleRefusal.NoTarget)]
    [InlineData("privacy",            new[] { "telegram" }, new[] { 1 }, "08:00", "12:00", ScheduleRuleRefusal.UnknownTarget)]
    [InlineData("mute_notifications", new[] { "cam1" },     new[] { 1 }, "08:00", "12:00", ScheduleRuleRefusal.UnknownTarget)]
    [InlineData("sprinklers",         new[] { "cam1" },     new[] { 1 }, "08:00", "12:00", ScheduleRuleRefusal.UnknownKind)]
    [InlineData("7",                  new[] { "cam1" },     new[] { 1 }, "08:00", "12:00", ScheduleRuleRefusal.UnknownKind)]
    public async Task ExecuteAsync_ShouldRefuseWithItsCodeAndSaveNothing_WhenTheRuleCannotBeKept(
        string kind, string[] targets, int[] days, string start, string end, ScheduleRuleRefusal expected)
    {
        // Arrange
        var request = new CreateScheduleRuleRequest(kind, targets, days, start, end);

        // Act
        var refusal = await Assert.ThrowsAsync<InvalidScheduleRuleException>(() => Create().ExecuteAsync(request));

        // Assert
        Assert.Equal(expected, refusal.Refusal);
        await _rules.DidNotReceive().AddAsync(Arg.Any<ScheduleRule>(), Arg.Any<CancellationToken>());
    }
#pragma warning restore format

    [Fact]
    public async Task ExecuteAsync_ShouldMoveTheRangeAndItsTargets_WhenTheRuleIsUpdated()
    {
        // Arrange
        var rule = Saved();
        _rules.GetByIdAsync("r1", Arg.Any<CancellationToken>()).Returns(rule);

        // Act
        await Update().ExecuteAsync("r1", new UpdateScheduleRuleRequest(["cam2"], [3], "22:00", "06:00"));

        // Assert
        Assert.Equal(("22:00", "06:00"), (rule.StartTime, rule.EndTime));
        Assert.Equal(["cam2"], rule.GetTargetIds());
        await _rules.Received(1).UpdateAsync(rule, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRefuseAndChangeNothing_WhenAnUpdateEmptiesTheRange()
    {
        // Arrange
        var rule = Saved();
        _rules.GetByIdAsync("r1", Arg.Any<CancellationToken>()).Returns(rule);

        // Act
        var refusal = await Assert.ThrowsAsync<InvalidScheduleRuleException>(
            () => Update().ExecuteAsync("r1", new UpdateScheduleRuleRequest(["cam2"], [1], "12:00", "12:00")));

        // Assert
        Assert.Equal(ScheduleRuleRefusal.EmptyRange, refusal.Refusal);
        Assert.Equal(("[3]", "08:00"), (rule.DaysOfWeek, rule.StartTime));
        Assert.Equal(["cam1"], rule.GetTargetIds());
        await _rules.DidNotReceive().UpdateAsync(Arg.Any<ScheduleRule>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldAnswerNull_WhenTheRuleToUpdateIsUnknown()
    {
        // Act
        var dto = await Update().ExecuteAsync("missing", new UpdateScheduleRuleRequest(["cam1"], [1], "08:00", "12:00"));

        // Assert
        Assert.Null(dto);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldDeleteTheRule_WhenItExists()
    {
        // Arrange
        var rule = Saved();
        _rules.GetByIdAsync("r1", Arg.Any<CancellationToken>()).Returns(rule);

        // Act
        var deleted = await new DeleteScheduleRuleUseCase(_rules).ExecuteAsync("r1");

        // Assert
        Assert.True(deleted);
        await _rules.Received(1).DeleteAsync(rule, Arg.Any<CancellationToken>());
    }
}
