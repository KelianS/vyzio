using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

/// <summary>
/// One implementation per command. It executes through the same use cases as the HTTP API — a command
/// is an inbound adapter, never a parallel business path (ADR-50).
/// </summary>
public interface IRemoteCommandHandler
{
    RemoteCommandDescriptor Descriptor { get; }

    Task<CommandResult> ExecuteAsync(CommandInvocation invocation, CancellationToken ct = default);
}

/// <summary>Resolves a command to its handler; the only place that knows the full list.</summary>
public interface IRemoteCommandRegistry
{
    IReadOnlyList<RemoteCommandDescriptor> Descriptors { get; }

    IRemoteCommandHandler? HandlerFor(RemoteCommandName command);
}
