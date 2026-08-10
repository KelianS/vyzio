using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.Commands;

/// <summary>
/// The only command an unpaired conversation may run, because it is how it stops being one. A wrong or
/// stale code gets no answer at all — a stranger must not even learn that Vyzio is there (ADR-50).
/// </summary>
public sealed class PairConversationCommandHandler(IChannelPairingRepository pairings) : IRemoteCommandHandler
{
    public const string CodeParameter = "code";

    public RemoteCommandDescriptor Descriptor { get; } = new(
        RemoteCommandName.Pair,
        "Relier cette conversation a votre installation avec le code affiche dans les reglages",
        CommandAuthorization.Pairing,
        [new RemoteCommandParameter(CodeParameter, CommandParameterKind.Text, Required: true, "Le code affiche dans les reglages")]);

    public async Task<CommandResult> ExecuteAsync(CommandInvocation invocation, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(invocation);

        var pairing = await pairings.GetByChannelAsync(invocation.Origin.Channel, ct);
        if (pairing is null) return CommandResult.Silence;

        if (pairing.Accepts(invocation.Origin.ConversationId))
            return CommandResult.Text("✅ Cette conversation est deja reliee a votre installation",
                ["Demandez-lui l'etat de chez vous quand vous voulez."]);

        if (!pairing.CodeMatches(invocation.Argument(CodeParameter), DateTimeOffset.UtcNow))
            return CommandResult.Silence;

        pairing.ConversationId = invocation.Origin.ConversationId;
        pairing.PairedAt = DateTimeOffset.UtcNow;
        pairing.PairingCode = null;
        pairing.CodeExpiresAt = null;
        await pairings.UpsertAsync(pairing, ct);

        return CommandResult.Text("✅ C'est fait, cette conversation est reliee a votre installation",
            ["Demandez-moi l'etat de chez vous.", "Vous pouvez couper ce lien a tout moment depuis les reglages."]);
    }
}
