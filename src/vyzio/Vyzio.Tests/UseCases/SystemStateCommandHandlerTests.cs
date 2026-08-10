using NSubstitute;
using Vyzio.Application.Commands;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Application.UseCases.Hub;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Notifications;

namespace Vyzio.Tests.UseCases;

public class SystemStateCommandHandlerTests
{
    private readonly IFrigateEventReader _events = Substitute.For<IFrigateEventReader>();
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly IProfileCameraLinkRepository _links = Substitute.For<IProfileCameraLinkRepository>();
    private readonly IProfileRepository _profiles = Substitute.For<IProfileRepository>();
    private readonly INotificationRepository _notifications = Substitute.For<INotificationRepository>();
    private readonly INotificationChannelConfigRepository _channelConfigs = Substitute.For<INotificationChannelConfigRepository>();
    private readonly IRecordingSettingsRepository _recordingSettings = Substitute.For<IRecordingSettingsRepository>();

    private static readonly CommandInvocation Invocation = new(
        RemoteCommandName.SystemState,
        new CommandOrigin(NotificationChannel.Telegram, "conversation-1"));

    private SystemStateCommandHandler CreateSut()
    {
        _recordingSettings.GetAsync(Arg.Any<CancellationToken>()).Returns(RecordingSettings.CreateDefault());
        _profiles.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);
        _notifications.CountSentAsync(Arg.Any<CancellationToken>()).Returns(0);
        _notifications.GetLastSentAtAsync(Arg.Any<CancellationToken>()).Returns((DateTimeOffset?)null);

        var sender = Substitute.For<INotificationChannelSender>();
        sender.Descriptor.Returns(new NotificationChannelDescriptor(
            NotificationChannel.Telegram,
            "Telegram",
            new ChannelCapabilities(true, true, true, false, 1024),
            new ChannelTransport([new ChannelCredentialSpec(ChannelCredential.BotToken, Secret: true)])));

        var overview = new GetHubOverviewUseCase(
            new GetRecentDetectionEventsUseCase(
                _events,
                new DetectionEventContractProjector(
                    new CameraDirectory(_cameras),
                    new DetectionProfileResolver(_profiles, _links),
                    _recordingSettings)),
            _profiles,
            _notifications,
            _channelConfigs,
            new NotificationChannelCatalog([sender]));

        return new SystemStateCommandHandler(overview, TimeZoneInfo.Utc);
    }

    private void ConfigureWorkingChannel()
        => _channelConfigs.GetAllAsync(Arg.Any<CancellationToken>()).Returns(
        [
            new NotificationChannelConfig
            {
                Channel = NotificationChannel.Telegram,
                IsEnabled = true,
                Credentials = new ChannelCredentials(new Dictionary<ChannelCredential, string>
                {
                    [ChannelCredential.BotToken] = "token"
                })
            }
        ]);

    [Fact]
    public void Declares_itself_as_a_consultation_open_to_any_paired_conversation()
    {
        var descriptor = CreateSut().Descriptor;

        Assert.Equal(RemoteCommandName.SystemState, descriptor.Name);
        Assert.Equal(CommandAuthorization.Paired, descriptor.Authorization);
        Assert.Empty(descriptor.Parameters);
    }

    [Fact]
    public async Task Tells_the_latest_detection_without_naming_the_detection_engine()
    {
        ConfigureWorkingChannel();
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns(
        [
            new Camera { Slug = "front_door", DisplayName = "Entree", Host = "127.0.0.1" }
        ]);
        _events.QueryAsync(Arg.Any<FrigateDetectionQuery>(), Arg.Any<CancellationToken>()).Returns(
        [
            new FrigateDetection("frigate-1", "front_door", "person", "Alice", 0.9f,
                DateTimeOffset.Parse("2026-05-12T10:00:00+00:00"), HasClip: true, HasSnapshot: true)
        ]);

        var result = await CreateSut().ExecuteAsync(Invocation);

        Assert.Contains("Alice", result.Message.Details[0]);
        Assert.Contains("Entree", result.Message.Details[0]);
        Assert.DoesNotContain(result.Message.Details, detail =>
            detail.Contains("frigate", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Carries_the_warnings_of_the_home_screen()
    {
        _channelConfigs.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);
        _events.QueryAsync(Arg.Any<FrigateDetectionQuery>(), Arg.Any<CancellationToken>()).Returns([]);

        var result = await CreateSut().ExecuteAsync(Invocation);

        Assert.Contains("Aucune detection recente", result.Message.Details);
        Assert.Contains("Aucun canal de notification n'est configure.", result.Message.Details);
    }
}
