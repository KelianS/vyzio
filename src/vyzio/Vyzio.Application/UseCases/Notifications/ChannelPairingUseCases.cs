using System.Security.Cryptography;
using Vyzio.Application.DTOs.Notifications;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Notifications;

/// <summary>Where the pairing of a channel stands; a channel that cannot listen has none to show (ADR-52).</summary>
public sealed class GetChannelPairingUseCase(
    INotificationChannelCatalog catalog,
    IChannelPairingRepository pairings,
    IRemoteCommandRegistry registry)
{
    public async Task<ChannelPairingDto?> ExecuteAsync(NotificationChannel channel, CancellationToken ct = default)
    {
        if (catalog.Describe(channel) is not { AcceptsCommands: true }) return null;

        var pairing = await pairings.GetByChannelAsync(channel, ct);
        return ChannelPairingDto.From(channel, pairing, registry);
    }
}

/// <summary>
/// Issues the code the user carries over to the conversation. Pairing always starts here, never in a
/// thread: the settings are the only place Vyzio knows it is really the owner talking (ADR-50).
/// </summary>
public sealed class StartChannelPairingUseCase(
    INotificationChannelCatalog catalog,
    IChannelPairingRepository pairings,
    IRemoteCommandRegistry registry)
{
    private static readonly TimeSpan CodeLifetime = TimeSpan.FromMinutes(10);

    public async Task<ChannelPairingDto?> ExecuteAsync(NotificationChannel channel, CancellationToken ct = default)
    {
        if (catalog.Describe(channel) is not { AcceptsCommands: true }) return null;

        var pairing = await pairings.GetByChannelAsync(channel, ct)
                      ?? new ChannelPairing { Channel = channel };

        // Starting over unpairs whatever was linked: two conversations must never be able to command at once.
        pairing.ConversationId = null;
        pairing.PairedAt = null;
        pairing.PairingCode = RandomNumberGenerator.GetInt32(100_000, 1_000_000).ToString();
        pairing.CodeExpiresAt = DateTimeOffset.UtcNow.Add(CodeLifetime);

        await pairings.UpsertAsync(pairing, ct);
        return ChannelPairingDto.From(channel, pairing, registry);
    }
}

public sealed class RevokeChannelPairingUseCase(IChannelPairingRepository pairings)
{
    public Task<bool> ExecuteAsync(NotificationChannel channel, CancellationToken ct = default)
        => pairings.DeleteByChannelAsync(channel, ct);
}
