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

    private PairConversationCommandHandler Sut()
        => new(_pairings, () => new RemoteCommandRegistry([]));

    private void Stored(ChannelPairing? pairing)
        => _pairings.GetByChannelAsync(NotificationChannel.Telegram, Arg.Any<CancellationToken>()).Returns(pairing);

    [Fact]
    public async Task ExecuteAsync_ShouldLinkTheConversation_WhenTheCodeIsTheOneTheSettingsIssued()
    {
        var pairing = new ChannelPairing
        {
            Channel = NotificationChannel.Telegram,
            PairingCode = "123456",
            CodeExpiresAt = DateTimeOffset.UtcNow.AddMinutes(5)
        };
        Stored(pairing);

        var result = await Sut().ExecuteAsync(Pair("123456"));

        Assert.False(result.Silent);
        Assert.Equal("conversation-1", pairing.ConversationId);
        Assert.Null(pairing.PairingCode);
        await _pairings.Received(1).UpsertAsync(pairing, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldStaySilentAndCountTheTry_WhenTheCodeIsWrong()
    {
        var pairing = new ChannelPairing
        {
            Channel = NotificationChannel.Telegram,
            PairingCode = "123456",
            CodeExpiresAt = DateTimeOffset.UtcNow.AddMinutes(5)
        };
        Stored(pairing);

        var result = await Sut().ExecuteAsync(Pair("999999"));

        Assert.True(result.Silent);
        Assert.Null(pairing.ConversationId);
        Assert.Equal(1, pairing.FailedAttempts);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldBurnTheCode_WhenItHasBeenGuessedAtTooManyTimes()
    {
        var pairing = new ChannelPairing
        {
            Channel = NotificationChannel.Telegram,
            PairingCode = "123456",
            CodeExpiresAt = DateTimeOffset.UtcNow.AddMinutes(5)
        };
        Stored(pairing);
        var sut = Sut();

        for (var attempt = 0; attempt < ChannelPairing.AllowedAttempts; attempt++)
            Assert.True((await sut.ExecuteAsync(Pair("999999"))).Silent);

        // Six digits fall well inside ten minutes to whoever may guess forever: the right code no longer works.
        Assert.Null(pairing.PairingCode);
        Assert.True((await sut.ExecuteAsync(Pair("123456"))).Silent);
        Assert.Null(pairing.ConversationId);
        await _pairings.Received(ChannelPairing.AllowedAttempts)
                       .UpsertAsync(pairing, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldStaySilentWithoutWriting_WhenTheCodeHasExpired()
    {
        Stored(new ChannelPairing
        {
            Channel = NotificationChannel.Telegram,
            PairingCode = "123456",
            CodeExpiresAt = DateTimeOffset.UtcNow.AddMinutes(-1)
        });

        var result = await Sut().ExecuteAsync(Pair("123456"));

        Assert.True(result.Silent);
        // Nothing left to burn: a stale code costs no write, however many times it is tried.
        await _pairings.DidNotReceive().UpsertAsync(Arg.Any<ChannelPairing>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldStaySilent_WhenNoPairingWasEverStarted()
    {
        Stored(null);

        Assert.True((await Sut().ExecuteAsync(Pair("123456"))).Silent);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldAnswerWithoutWriting_WhenTheConversationIsAlreadyLinked()
    {
        Stored(new ChannelPairing
        {
            Channel = NotificationChannel.Telegram,
            ConversationId = "conversation-1",
            PairedAt = DateTimeOffset.UtcNow
        });

        var result = await Sut().ExecuteAsync(Pair("whatever"));

        Assert.False(result.Silent);
        await _pairings.DidNotReceive().UpsertAsync(Arg.Any<ChannelPairing>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public void Descriptor_ShouldAuthorizeAnUnpairedConversationWithOneTextParameter_WhenThePairingCommandIsDescribed()
    {
        var descriptor = Sut().Descriptor;

        Assert.Equal(CommandAuthorization.Pairing, descriptor.Authorization);
        Assert.Equal(CommandParameterKind.Text, Assert.Single(descriptor.Parameters).Kind);
    }
}
