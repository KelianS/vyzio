using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.Commands;

/// <summary>
/// « Qu'est-ce que je peux te demander » — the registry read out loud, so nobody has to go find a
/// documentation to use their own installation (ADR-50).
/// </summary>
public sealed class HelpCommandHandler(Func<IRemoteCommandRegistry> registry) : IRemoteCommandHandler
{
    public RemoteCommandDescriptor Descriptor { get; } = RemoteCommandDescriptor.Consultation(
        RemoteCommandName.Help,
        "aide",
        "Ce que vous pouvez me demander");

    public Task<CommandResult> ExecuteAsync(CommandInvocation invocation, CancellationToken ct = default)
        => Task.FromResult(new CommandResult(
            CommandCatalogue.Describe(registry(), "Voici ce que vous pouvez me demander")));
}
