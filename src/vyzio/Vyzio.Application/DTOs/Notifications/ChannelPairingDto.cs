using Vyzio.Core.Common;
using Vyzio.Core.Entities;

namespace Vyzio.Application.DTOs.Notifications;

/// <summary>
/// What the settings screen shows of a pairing. The conversation itself is never handed back — knowing
/// that one is linked is all the screen needs, and it is one identifier less to leak.
/// </summary>
public sealed record ChannelPairingDto(
    string Channel,
    string Status,
    string? Code,
    DateTimeOffset? CodeExpiresAt,
    DateTimeOffset? PairedAt)
{
    public static ChannelPairingDto From(NotificationChannel channel, ChannelPairing? pairing)
    {
        var state = pairing?.StateAt(DateTimeOffset.UtcNow) ?? ChannelPairingState.NotPaired;

        return new ChannelPairingDto(
            Channel: SnakeCaseEnum.ToSnakeCase(channel),
            Status: SnakeCaseEnum.ToSnakeCase(state),
            Code: state == ChannelPairingState.AwaitingConversation ? pairing?.PairingCode : null,
            CodeExpiresAt: state == ChannelPairingState.AwaitingConversation ? pairing?.CodeExpiresAt : null,
            PairedAt: pairing?.PairedAt);
    }
}
