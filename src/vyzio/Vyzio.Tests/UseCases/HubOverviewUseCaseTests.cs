using NSubstitute;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Application.UseCases.Hub;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class GetHubOverviewUseCaseTests
{
    private readonly IDetectionEventRepository _events = Substitute.For<IDetectionEventRepository>();
    private readonly IProfileRepository _profiles = Substitute.For<IProfileRepository>();
    private readonly INotificationRepository _notifications = Substitute.For<INotificationRepository>();
    private readonly INotificationChannelConfigRepository _channelConfigs = Substitute.For<INotificationChannelConfigRepository>();

    [Fact]
    public async Task Execute_returns_hub_overview_with_recent_events_profiles_and_notification_summary()
    {
        _events.GetRecentAsync(5, Arg.Any<CancellationToken>()).Returns(
        [
            new DetectionEvent
            {
                Id = "evt-1",
                FrigateEventId = "frigate-1",
                Lifecycle = "new",
                Camera = "front_door",
                Label = "person",
                Identity = "Alice"
            }
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

        var sut = new GetHubOverviewUseCase(
            _events,
            _profiles,
            _notifications,
            _channelConfigs,
            new DetectionEventContractProjector());

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
        _events.GetRecentAsync(5, Arg.Any<CancellationToken>()).Returns([]);
        _profiles.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);
        _notifications.CountSentAsync("telegram", Arg.Any<CancellationToken>()).Returns(0);
        _notifications.GetLastSentAtAsync("telegram", Arg.Any<CancellationToken>()).Returns((DateTimeOffset?)null);
        _channelConfigs.GetByChannelAsync("telegram", Arg.Any<CancellationToken>())
            .Returns((NotificationChannelConfig?)null);

        var sut = new GetHubOverviewUseCase(
            _events,
            _profiles,
            _notifications,
            _channelConfigs,
            new DetectionEventContractProjector());

        var overview = await sut.ExecuteAsync();

        Assert.Contains("Telegram n'est pas encore configure.", overview.Warnings);
    }
}
