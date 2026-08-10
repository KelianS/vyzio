using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.Commands;

/// <summary>
/// The only command an unpaired conversation may run, because it is how it stops being one. A wrong or
/// stale code gets no answer at all — a stranger must not even learn that Vyzio is there (ADR-50).
/// </summary>
public sealed class PairConversationCommandHandler(
    IChannelPairingRepository pairings,
    Func<IRemoteCommandRegistry> registry) : IRemoteCommandHandler
{
    public const string CodeParameter = "code";

    public RemoteCommandDescriptor Descriptor { get; } = new(
        RemoteCommandName.Pair,
        "relier",
        "Relier cette conversation a votre installation avec le code affiche dans les reglages",
        CommandAuthorization.Pairing,
        [new RemoteCommandParameter(CodeParameter, CommandParameterKind.Text, Required: true, "Le code affiche dans les reglages")]);

    public async Task<CommandResult> ExecuteAsync(CommandInvocation invocation, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(invocation);

        var pairing = await pairings.GetByChannelAsync(invocation.Origin.Channel, ct);
        if (pairing is null) return CommandResult.Silence;

        // Landing on the catalogue rather than on a congratulation: the first question is always
        // "et maintenant, qu'est-ce que je fais ?".
        if (pairing.Accepts(invocation.Origin.ConversationId))
            return new CommandResult(CommandCatalogue.Describe(
                registry(), "✅ Cette conversation est deja reliee a votre installation"));

        if (!pairing.CodeMatches(invocation.Argument(CodeParameter), DateTimeOffset.UtcNow))
            return CommandResult.Silence;

        pairing.ConversationId = invocation.Origin.ConversationId;
        pairing.PairedAt = DateTimeOffset.UtcNow;
        pairing.PairingCode = null;
        pairing.CodeExpiresAt = null;
        await pairings.UpsertAsync(pairing, ct);

        return new CommandResult(CommandCatalogue.Describe(
            registry(), "✅ C'est fait — voici ce que vous pouvez me demander"));
    }
}
