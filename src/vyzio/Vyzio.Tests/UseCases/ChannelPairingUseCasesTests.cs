using NSubstitute;
using Vyzio.Application.Commands;
using Vyzio.Application.UseCases.Notifications;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Notifications;

namespace Vyzio.Tests.UseCases;

public class ChannelPairingUseCasesTests
{
    private readonly IChannelPairingRepository _pairings = Substitute.For<IChannelPairingRepository>();

    private static IRemoteCommandRegistry Registry()
        => new RemoteCommandRegistry([new PairConversationCommandHandler(
            Substitute.For<IChannelPairingRepository>(), () => new RemoteCommandRegistry([]))]);

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
    public async Task Starting_a_pairing_issues_a_code_that_expires()
    {
        var dto = await new StartChannelPairingUseCase(Catalog(), _pairings, Registry())
            .ExecuteAsync(NotificationChannel.Telegram);

        Assert.NotNull(dto);
        Assert.Equal("awaiting_conversation", dto.Status);
        Assert.Equal(6, dto.Code!.Length);
        // What to type comes from the registry: the screen must never spell a command name itself.
        Assert.Equal($"/relier {dto.Code}", dto.Instruction);
        Assert.True(dto.CodeExpiresAt > DateTimeOffset.UtcNow);
        await _pairings.Received(1).UpsertAsync(Arg.Any<ChannelPairing>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Starting_over_unlinks_the_conversation_that_was_paired()
    {
        var existing = new ChannelPairing
        {
            Channel = NotificationChannel.Telegram,
            ConversationId = "conversation-1",
            PairedAt = DateTimeOffset.UtcNow
        };
        _pairings.GetByChannelAsync(NotificationChannel.Telegram, Arg.Any<CancellationToken>()).Returns(existing);

        await new StartChannelPairingUseCase(Catalog(), _pairings, Registry()).ExecuteAsync(NotificationChannel.Telegram);

        Assert.Null(existing.ConversationId);
        Assert.Null(existing.PairedAt);
    }

    [Fact]
    public async Task A_channel_that_cannot_listen_has_no_pairing_to_offer()
    {
        Assert.Null(await new StartChannelPairingUseCase(Catalog(), _pairings, Registry()).ExecuteAsync(NotificationChannel.Discord));
        Assert.Null(await new GetChannelPairingUseCase(Catalog(), _pairings, Registry()).ExecuteAsync(NotificationChannel.Discord));
    }

    [Fact]
    public async Task An_untouched_channel_reads_as_not_paired_and_never_leaks_the_conversation()
    {
        _pairings.GetByChannelAsync(NotificationChannel.Telegram, Arg.Any<CancellationToken>())
                 .Returns((ChannelPairing?)null);

        var dto = await new GetChannelPairingUseCase(Catalog(), _pairings, Registry()).ExecuteAsync(NotificationChannel.Telegram);

        Assert.Equal("not_paired", dto!.Status);
        Assert.Null(dto.Code);
    }

    [Fact]
    public async Task A_paired_channel_shows_when_it_was_linked_but_not_the_code()
    {
        _pairings.GetByChannelAsync(NotificationChannel.Telegram, Arg.Any<CancellationToken>()).Returns(
            new ChannelPairing
            {
                Channel = NotificationChannel.Telegram,
                ConversationId = "conversation-1",
                PairedAt = DateTimeOffset.UtcNow
            });

        var dto = await new GetChannelPairingUseCase(Catalog(), _pairings, Registry()).ExecuteAsync(NotificationChannel.Telegram);

        Assert.Equal("paired", dto!.Status);
        Assert.Null(dto.Code);
        Assert.NotNull(dto.PairedAt);
    }
}
