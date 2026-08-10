using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

/// <summary>
/// The receiving side of a channel: Vyzio goes and fetches, since it has no public address (ADR-50).
/// One implementation per channel able to listen, and nothing above it knows which one it holds.
/// </summary>
public interface IChannelCommandReceiver
{
    NotificationChannel Channel { get; }

    /// <summary>Declares the commands in the channel's own grammar, so its autocompletion becomes the documentation (ADR-52).</summary>
    Task PublishCommandsAsync(
        IReadOnlyList<RemoteCommandDescriptor> commands,
        ChannelCredentials credentials,
        CancellationToken ct = default);

    /// <summary>Waits for what is addressed to Vyzio, matched against the given declarations.</summary>
    Task<IReadOnlyList<IncomingMessage>> ReceiveAsync(
        IReadOnlyList<RemoteCommandDescriptor> commands,
        ChannelCredentials credentials,
        CancellationToken ct = default);

    Task RespondAsync(
        CommandOrigin origin,
        CommandResult result,
        ChannelCredentials credentials,
        CancellationToken ct = default);
}

/// <summary>Resolves a channel to its receiver; empty for a channel that only sends.</summary>
public interface IChannelCommandReceiverCatalog
{
    IChannelCommandReceiver? ReceiverFor(NotificationChannel channel);
}
