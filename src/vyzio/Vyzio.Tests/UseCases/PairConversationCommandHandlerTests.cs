using NSubstitute;
using Vyzio.Application.Commands;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class PairConversationCommandHandlerTests
{
    private readonly IChannelPairingRepository _pairings = Substitute.For<IChannelPairingRepository>();

    private static CommandInvocation Pair(string code, string conversationId = "conversation-1")
        => new(RemoteCommandName.Pair,
               new CommandOrigin(NotificationChannel.Telegram, conversationId),
               new Dictionary<string, string> { [PairConversationCommandHandler.CodeParameter] = code });

    private void Stored(ChannelPairing? pairing)
        => _pairings.GetByChannelAsync(NotificationChannel.Telegram, Arg.Any<CancellationToken>()).Returns(pairing);

    [Fact]
    public async Task Links_the_conversation_when_the_code_is_the_one_the_settings_issued()
    {
        var pairing = new ChannelPairing
        {
            Channel = NotificationChannel.Telegram,
            PairingCode = "123456",
            CodeExpiresAt = DateTimeOffset.UtcNow.AddMinutes(5)
        };
        Stored(pairing);

        var result = await new PairConversationCommandHandler(_pairings).ExecuteAsync(Pair("123456"));

        Assert.False(result.Silent);
        Assert.Equal("conversation-1", pairing.ConversationId);
        Assert.Null(pairing.PairingCode);
        await _pairings.Received(1).UpsertAsync(pairing, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Says_nothing_at_all_on_a_wrong_code()
    {
        Stored(new ChannelPairing
        {
            Channel = NotificationChannel.Telegram,
            PairingCode = "123456",
            CodeExpiresAt = DateTimeOffset.UtcNow.AddMinutes(5)
        });

        var result = await new PairConversationCommandHandler(_pairings).ExecuteAsync(Pair("999999"));

        Assert.True(result.Silent);
        await _pairings.DidNotReceive().UpsertAsync(Arg.Any<ChannelPairing>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Says_nothing_at_all_on_an_expired_code()
    {
        Stored(new ChannelPairing
        {
            Channel = NotificationChannel.Telegram,
            PairingCode = "123456",
            CodeExpiresAt = DateTimeOffset.UtcNow.AddMinutes(-1)
        });

        var result = await new PairConversationCommandHandler(_pairings).ExecuteAsync(Pair("123456"));

        Assert.True(result.Silent);
    }

    [Fact]
    public async Task Says_nothing_at_all_when_no_pairing_was_ever_started()
    {
        Stored(null);

        Assert.True((await new PairConversationCommandHandler(_pairings).ExecuteAsync(Pair("123456"))).Silent);
    }

    [Fact]
    public async Task Answers_a_conversation_that_is_already_linked()
    {
        Stored(new ChannelPairing
        {
            Channel = NotificationChannel.Telegram,
            ConversationId = "conversation-1",
            PairedAt = DateTimeOffset.UtcNow
        });

        var result = await new PairConversationCommandHandler(_pairings).ExecuteAsync(Pair("whatever"));

        Assert.False(result.Silent);
        await _pairings.DidNotReceive().UpsertAsync(Arg.Any<ChannelPairing>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public void Is_the_one_command_an_unpaired_conversation_may_run()
    {
        var descriptor = new PairConversationCommandHandler(_pairings).Descriptor;

        Assert.Equal(CommandAuthorization.Pairing, descriptor.Authorization);
        Assert.Equal(CommandParameterKind.Text, Assert.Single(descriptor.Parameters).Kind);
    }
}
