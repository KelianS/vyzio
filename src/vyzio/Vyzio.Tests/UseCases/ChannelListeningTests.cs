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
    public void A_channel_nobody_started_listening_on_says_so()
    {
        var dto = new GetChannelListeningUseCase(Catalog(), new ChannelListenerHealth())
            .Execute(NotificationChannel.Telegram);

        Assert.NotNull(dto);
        Assert.False(dto.Listening);
        Assert.Null(dto.Since);
    }

    [Fact]
    public void An_interrupted_loop_reads_as_silent_and_says_why()
    {
        var health = new ChannelListenerHealth();
        health.Started(NotificationChannel.Telegram);
        health.Interrupted(NotificationChannel.Telegram, "No such host is known.");

        var dto = new GetChannelListeningUseCase(Catalog(), health).Execute(NotificationChannel.Telegram);

        Assert.NotNull(dto);
        Assert.False(dto.Listening);
        Assert.Equal("No such host is known.", dto.Reason);
        Assert.NotNull(dto.InterruptedAt);
    }

    [Fact]
    public void A_loop_that_comes_back_keeps_the_trace_of_the_interruption()
    {
        var health = new ChannelListenerHealth();
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
    public void Rounds_that_keep_coming_back_do_not_restart_the_clock()
    {
        var health = new ChannelListenerHealth();
        health.Started(NotificationChannel.Telegram);
        var since = health.StateOf(NotificationChannel.Telegram).Since;

        health.Started(NotificationChannel.Telegram);

        Assert.Equal(since, health.StateOf(NotificationChannel.Telegram).Since);
    }

    [Fact]
    public void A_channel_taken_down_on_purpose_stops_claiming_anything()
    {
        var health = new ChannelListenerHealth();
        health.Started(NotificationChannel.Telegram);
        health.Stopped(NotificationChannel.Telegram);

        Assert.False(health.StateOf(NotificationChannel.Telegram).Listening);
    }

    [Fact]
    public void A_channel_that_cannot_listen_has_nothing_to_show()
    {
        var dto = new GetChannelListeningUseCase(Catalog(), new ChannelListenerHealth())
            .Execute(NotificationChannel.Discord);

        Assert.Null(dto);
    }

    [Fact]
    public async Task The_journal_of_a_channel_names_the_command_as_it_was_typed()
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
