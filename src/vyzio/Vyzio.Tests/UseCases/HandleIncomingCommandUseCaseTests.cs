using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Application.Commands;
using Vyzio.Application.UseCases.Commands;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class HandleIncomingCommandUseCaseTests
{
    private readonly ICommandJournalRepository _journal = Substitute.For<ICommandJournalRepository>();
    private readonly IChannelPairingRepository _pairings = Substitute.For<IChannelPairingRepository>();
    private readonly IRemoteCommandHandler _systemState = Handler(
        RemoteCommandDescriptor.Consultation(RemoteCommandName.SystemState, "maison", "Ce qui se passe chez vous"));

    private static IncomingMessage From(string conversationId, RemoteCommandName command = RemoteCommandName.SystemState)
        => new(new CommandOrigin(NotificationChannel.Telegram, conversationId), command);

    private static IRemoteCommandHandler Handler(RemoteCommandDescriptor descriptor)
    {
        var handler = Substitute.For<IRemoteCommandHandler>();
        handler.Descriptor.Returns(descriptor);
        handler.ExecuteAsync(Arg.Any<CommandInvocation>(), Arg.Any<CancellationToken>())
               .Returns(CommandResult.Text("Tout va bien chez vous", []));
        return handler;
    }

    private HandleIncomingCommandUseCase Build(params IRemoteCommandHandler[] handlers)
    {
        var registry = new RemoteCommandRegistry(handlers);
        return new HandleIncomingCommandUseCase(
            registry,
            _pairings,
            _journal,
            new ExecuteRemoteCommandUseCase(registry, _journal, NullLogger<ExecuteRemoteCommandUseCase>.Instance));
    }

    private void Paired(string conversationId)
        => _pairings.GetByChannelAsync(NotificationChannel.Telegram, Arg.Any<CancellationToken>()).Returns(
            new ChannelPairing
            {
                Channel = NotificationChannel.Telegram,
                ConversationId = conversationId,
                PairedAt = DateTimeOffset.UtcNow
            });

    private async Task<CommandJournal> SingleJournalEntryAsync()
    {
        var call = Assert.Single(_journal.ReceivedCalls());
        await Task.CompletedTask;
        return (CommandJournal)call.GetArguments()[0]!;
    }

    [Fact]
    public async Task Answers_the_paired_conversation()
    {
        Paired("conversation-1");

        var result = await Build(_systemState).ExecuteAsync(From("conversation-1"));

        Assert.False(result.Silent);
        Assert.Equal("Tout va bien chez vous", result.Message.Headline);
    }

    [Fact]
    public async Task Leaves_a_stranger_with_nothing_but_a_line_in_the_journal()
    {
        Paired("conversation-1");

        var result = await Build(_systemState).ExecuteAsync(From("conversation-999"));

        Assert.True(result.Silent);
        await _systemState.DidNotReceive().ExecuteAsync(Arg.Any<CommandInvocation>(), Arg.Any<CancellationToken>());

        var entry = await SingleJournalEntryAsync();
        Assert.Equal(CommandOutcome.Rejected, entry.Outcome);
        Assert.Equal("conversation-999", entry.ConversationId);
    }

    [Fact]
    public async Task Leaves_every_conversation_with_nothing_while_no_pairing_exists()
    {
        _pairings.GetByChannelAsync(NotificationChannel.Telegram, Arg.Any<CancellationToken>())
                 .Returns((ChannelPairing?)null);

        Assert.True((await Build(_systemState).ExecuteAsync(From("conversation-1"))).Silent);
    }

    [Fact]
    public async Task Lets_an_unpaired_conversation_run_the_pairing_command()
    {
        _pairings.GetByChannelAsync(NotificationChannel.Telegram, Arg.Any<CancellationToken>())
                 .Returns((ChannelPairing?)null);
        var pair = Handler(new RemoteCommandDescriptor(
            RemoteCommandName.Pair, "relier", "Relier cette conversation", CommandAuthorization.Pairing, []));

        await Build(_systemState, pair).ExecuteAsync(From("conversation-1", RemoteCommandName.Pair));

        await pair.Received(1).ExecuteAsync(Arg.Any<CommandInvocation>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Tells_the_paired_conversation_what_it_may_ask_when_it_says_something_else()
    {
        Paired("conversation-1");

        var result = await Build(_systemState).ExecuteAsync(
            new IncomingMessage(new CommandOrigin(NotificationChannel.Telegram, "conversation-1"), Command: null));

        Assert.False(result.Silent);
        Assert.Contains("/maison", Assert.Single(result.Message.Details));
        // Not a command: there is nothing to journal, and a chatty conversation must not fill the journal.
        Assert.Empty(_journal.ReceivedCalls());
    }

    [Fact]
    public async Task Says_nothing_to_a_stranger_who_says_something_it_does_not_understand()
    {
        Paired("conversation-1");

        var result = await Build(_systemState).ExecuteAsync(
            new IncomingMessage(new CommandOrigin(NotificationChannel.Telegram, "conversation-999"), Command: null));

        Assert.True(result.Silent);
        Assert.Empty(_journal.ReceivedCalls());
    }
}
