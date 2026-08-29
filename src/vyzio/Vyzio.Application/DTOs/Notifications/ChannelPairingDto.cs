using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.DTOs.Notifications;

/// <summary>
/// What the settings screen shows of a pairing. The conversation itself is never handed back — knowing
/// that one is linked is all the screen needs, and it is one identifier less to leak.
/// </summary>
/// <param name="Instruction">Exactly what to type in the conversation — composed from the registry, so
/// the screen never invents a command name of its own (ADR-50).</param>
public sealed record ChannelPairingDto(
    string Channel,
    string Status,
    string? Code,
    string? Instruction,
    DateTimeOffset? CodeExpiresAt,
    DateTimeOffset? PairedAt)
{
    public static ChannelPairingDto From(
        NotificationChannel channel,
        ChannelPairing? pairing,
        IRemoteCommandRegistry registry)
    {
        ArgumentNullException.ThrowIfNull(registry);

        var state = pairing?.StateAt(DateTimeOffset.UtcNow) ?? ChannelPairingState.NotPaired;
        var awaiting = state == ChannelPairingState.AwaitingConversation;
        var verb = registry.Descriptors
            .FirstOrDefault(descriptor => descriptor.Authorization == CommandAuthorization.Pairing)?.Verb;

        return new ChannelPairingDto(
            Channel: SnakeCaseEnum.ToSnakeCase(channel),
            Status: SnakeCaseEnum.ToSnakeCase(state),
            Code: awaiting ? pairing?.PairingCode : null,
            Instruction: awaiting && verb is not null ? $"/{verb} {pairing?.PairingCode}" : null,
            CodeExpiresAt: awaiting ? pairing?.CodeExpiresAt : null,
            PairedAt: pairing?.PairedAt);
    }
}
