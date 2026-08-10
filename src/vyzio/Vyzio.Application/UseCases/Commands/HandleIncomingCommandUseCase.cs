using Vyzio.Application.Commands;
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
    public async Task<CommandResult> ExecuteAsync(IncomingMessage incoming, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(incoming);

        var pairing = await pairings.GetByChannelAsync(incoming.Origin.Channel, ct);
        var isPaired = pairing?.Accepts(incoming.Origin.ConversationId) == true;

        var descriptor = incoming.Command is { } command ? registry.HandlerFor(command)?.Descriptor : null;
        if (descriptor is null)
            // Not understood: the paired conversation is told what it may ask, a stranger still hears nothing.
            return isPaired
                ? new CommandResult(CommandCatalogue.Describe(
                    registry, "Je n'ai pas compris — voici ce que vous pouvez me demander"))
                : CommandResult.Silence;

        if (!isPaired && descriptor.Authorization != CommandAuthorization.Pairing)
        {
            await journal.AddAsync(new CommandJournal
            {
                Channel = incoming.Origin.Channel,
                ConversationId = incoming.Origin.ConversationId,
                Command = descriptor.Name,
                Outcome = CommandOutcome.Rejected
            }, ct);

            return CommandResult.Silence;
        }

        return await execute.ExecuteAsync(incoming.ToInvocation(), ct);
    }
}
