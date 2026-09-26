using NSubstitute;
using Vyzio.Application.Commands;
using Vyzio.Application.Services;
using Vyzio.Application.UseCases.Commands;
using Vyzio.Application.UseCases.Notifications;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Notifications;

namespace Vyzio.Tests.UseCases;

/// <summary>
/// Ce qui rend une panne lisible : la boucle est en memoire, donc rien d'enregistre ne dit qu'elle
/// tourne encore. Si ces tests tombent, un canal muet passera pour un canal en bonne sante.
/// </summary>
public class ChannelListeningTests
{
    private static INotificationChannelCatalog Catalog()
    {
        var listening = Substitute.For<INotificationChannelSender>();
        listening.Descriptor.Returns(new NotificationChannelDescriptor(
            NotificationChannel.Telegram,
            "Telegram",
            new ChannelCapabilities(true, true, true, true, 1024),
            new ChannelTransport([new ChannelCredentialSpec(ChannelCredential.BotToken, Secret: true)]),
            new ChannelTransport([new ChannelCredentialSpec(ChannelCredential.BotToken, Secret: true)])));

        var deaf = Substitute.For<INotificationChannelSender>();
        deaf.Descriptor.Returns(new NotificationChannelDescriptor(
            NotificationChannel.Discord,
            "Discord",
            new ChannelCapabilities(true, true, true, false, 2000),
            new ChannelTransport([new ChannelCredentialSpec(ChannelCredential.ChatId, Secret: true)])));

        return new NotificationChannelCatalog([listening, deaf]);
    }

    [Fact]
    public void Execute_ShouldReportNotListening_WhenNobodyStartedListeningOnTheChannel()
    {
        var dto = new GetChannelListeningUseCase(Catalog(), new ChannelListenerHealth(TimeProvider.System))
            .Execute(NotificationChannel.Telegram);

        Assert.NotNull(dto);
        Assert.False(dto.Listening);
        Assert.Null(dto.Since);
    }

    [Fact]
    public void Execute_ShouldReportSilentWithTheReason_WhenTheLoopWasInterrupted()
    {
        var health = new ChannelListenerHealth(TimeProvider.System);
        health.Started(NotificationChannel.Telegram);
        health.Interrupted(NotificationChannel.Telegram, "No such host is known.");

        var dto = new GetChannelListeningUseCase(Catalog(), health).Execute(NotificationChannel.Telegram);

        Assert.NotNull(dto);
        Assert.False(dto.Listening);
        Assert.Equal("No such host is known.", dto.Reason);
        Assert.NotNull(dto.InterruptedAt);
    }

    [Fact]
    public void Started_ShouldKeepTheTraceOfTheInterruption_WhenTheLoopComesBack()
    {
        var health = new ChannelListenerHealth(TimeProvider.System);
        health.Interrupted(NotificationChannel.Telegram, "Network unreachable.");
        health.Started(NotificationChannel.Telegram);

        // Un canal qui va et vient ne laisse aucune autre trace : l'oublier a la
        // reprise, c'est effacer la seule explication d'une alerte manquee.
        var state = health.StateOf(NotificationChannel.Telegram);
        Assert.True(state.Listening);
        Assert.NotNull(state.Since);
        Assert.Equal("Network unreachable.", state.Reason);
    }

    [Fact]
    public void Started_ShouldNotRestartTheClock_WhenTheLoopKeepsComingBack()
    {
        var health = new ChannelListenerHealth(TimeProvider.System);
        health.Started(NotificationChannel.Telegram);
        var since = health.StateOf(NotificationChannel.Telegram).Since;

        health.Started(NotificationChannel.Telegram);

        Assert.Equal(since, health.StateOf(NotificationChannel.Telegram).Since);
    }

    [Fact]
    public void Stopped_ShouldStopClaimingToListen_WhenTheChannelIsTakenDownOnPurpose()
    {
        var health = new ChannelListenerHealth(TimeProvider.System);
        health.Started(NotificationChannel.Telegram);
        health.Stopped(NotificationChannel.Telegram);

        Assert.False(health.StateOf(NotificationChannel.Telegram).Listening);
    }

    [Fact]
    public void Execute_ShouldReturnNull_WhenTheChannelCannotListen()
    {
        var dto = new GetChannelListeningUseCase(Catalog(), new ChannelListenerHealth(TimeProvider.System))
            .Execute(NotificationChannel.Discord);

        Assert.Null(dto);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldNameTheCommandAsItWasTyped_WhenReadingTheChannelJournal()
    {
        var journal = Substitute.For<ICommandJournalRepository>();
        journal.GetRecentAsync(NotificationChannel.Telegram, Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns([
                new CommandJournal
                {
                    Channel = NotificationChannel.Telegram,
                    ConversationId = "42",
                    Command = RemoteCommandName.Help,
                    Outcome = CommandOutcome.Rejected,
                },
            ]);

        var entries = await new GetCommandJournalUseCase(journal, Registry())
            .ExecuteAsync(NotificationChannel.Telegram);

        var entry = Assert.Single(entries);
        Assert.Equal("aide", entry.Verb);
        Assert.Equal("rejected", entry.Outcome);
    }

    private static IRemoteCommandRegistry Registry()
        => new RemoteCommandRegistry([new HelpCommandHandler(() => new RemoteCommandRegistry([]))]);
}
