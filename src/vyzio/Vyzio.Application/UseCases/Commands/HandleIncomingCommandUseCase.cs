using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Commands;

/// <summary>
/// The authentication boundary of the inbound channel: only the paired conversation is served, and any
/// other origin leaves with nothing but a line in the journal (ADR-50).
/// </summary>
public sealed class HandleIncomingCommandUseCase(
    IRemoteCommandRegistry registry,
    IChannelPairingRepository pairings,
    ICommandJournalRepository journal,
    ExecuteRemoteCommandUseCase execute)
{
    public async Task<CommandResult> ExecuteAsync(IncomingCommand incoming, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(incoming);

        var descriptor = registry.HandlerFor(incoming.Command)?.Descriptor;
        if (descriptor is null) return CommandResult.Silence;

        var pairing = await pairings.GetByChannelAsync(incoming.Origin.Channel, ct);
        var isPaired = pairing?.Accepts(incoming.Origin.ConversationId) == true;

        if (!isPaired && descriptor.Authorization != CommandAuthorization.Pairing)
        {
            await journal.AddAsync(new CommandJournal
            {
                Channel = incoming.Origin.Channel,
                ConversationId = incoming.Origin.ConversationId,
                Command = incoming.Command,
                Outcome = CommandOutcome.Rejected
            }, ct);

            return CommandResult.Silence;
        }

        return await execute.ExecuteAsync(incoming.ToInvocation(), ct);
    }
}
