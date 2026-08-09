using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Application.UseCases.Hub;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class GetHubOverviewUseCaseTests
{
    private readonly IFrigateEventReader _events = Substitute.For<IFrigateEventReader>();
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly IProfileCameraLinkRepository _links = Substitute.For<IProfileCameraLinkRepository>();
    private readonly IProfileRepository _profiles = Substitute.For<IProfileRepository>();
    private readonly INotificationRepository _notifications = Substitute.For<INotificationRepository>();
    private readonly INotificationChannelConfigRepository _channelConfigs = Substitute.For<INotificationChannelConfigRepository>();

    private GetHubOverviewUseCase CreateSut()
        => new(
            new GetRecentDetectionEventsUseCase(
                _events,
                new DetectionEventContractProjector(
                    new CameraDirectory(_cameras),
                    new DetectionProfileResolver(_profiles, _links))),
            _profiles,
            _notifications,
            _channelConfigs);

    [Fact]
    public async Task Execute_returns_hub_overview_with_recent_events_profiles_and_notification_summary()
    {
        _events.QueryAsync(Arg.Any<FrigateDetectionQuery>(), Arg.Any<CancellationToken>()).Returns(
        [
            new FrigateDetection("frigate-1", "front_door", "person", "Alice", 0.9f,
                DateTimeOffset.Parse("2026-05-12T10:00:00+00:00"), HasClip: true, HasSnapshot: true)
        ]);
        _profiles.GetAllAsync(Arg.Any<CancellationToken>()).Returns(
        [
            new Profile { Name = "Alice", Category = "household", AlertMode = "notify" },
            new Profile { Name = "Bob", Category = "known", AlertMode = "silent" }
        ]);
        _notifications.CountSentAsync("telegram", Arg.Any<CancellationToken>()).Returns(3);
        _notifications.GetLastSentAtAsync("telegram", Arg.Any<CancellationToken>())
            .Returns(DateTimeOffset.Parse("2026-05-12T10:30:00+00:00"));
        _channelConfigs.GetByChannelAsync("telegram", Arg.Any<CancellationToken>())
            .Returns(new NotificationChannelConfig
            {
                Channel = "telegram",
                IsEnabled = true,
                BotToken = "token",
                ChatId = "chat"
            });

        var sut = CreateSut();

        var overview = await sut.ExecuteAsync();

        Assert.True(overview.SystemHealthy);
        Assert.Single(overview.RecentEvents);
        Assert.Equal(2, overview.Profiles.Count);
        Assert.True(overview.Notifications.TelegramConfigured);
        Assert.Equal(3, overview.Notifications.SentCount);
        Assert.Empty(overview.Warnings);
    }

    [Fact]
    public async Task Execute_adds_warning_when_telegram_is_not_configured()
    {
        _events.QueryAsync(Arg.Any<FrigateDetectionQuery>(), Arg.Any<CancellationToken>()).Returns([]);
        _profiles.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);
        _notifications.CountSentAsync("telegram", Arg.Any<CancellationToken>()).Returns(0);
        _notifications.GetLastSentAtAsync("telegram", Arg.Any<CancellationToken>()).Returns((DateTimeOffset?)null);
        _channelConfigs.GetByChannelAsync("telegram", Arg.Any<CancellationToken>())
            .Returns((NotificationChannelConfig?)null);

        var sut = CreateSut();

        var overview = await sut.ExecuteAsync();

        Assert.Contains("Telegram n'est pas encore configure.", overview.Warnings);
    }
}
