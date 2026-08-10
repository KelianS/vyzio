using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.Commands;

/// <summary>Adding a command is a registration, not an edit anywhere else (ADR-50).</summary>
public sealed class RemoteCommandRegistry : IRemoteCommandRegistry
{
    private readonly Dictionary<RemoteCommandName, IRemoteCommandHandler> _handlers;

    public RemoteCommandRegistry(IEnumerable<IRemoteCommandHandler> handlers)
    {
        _handlers = handlers.ToDictionary(handler => handler.Descriptor.Name);
        Descriptors = [.. _handlers.Values.Select(handler => handler.Descriptor)];
    }

    public IReadOnlyList<RemoteCommandDescriptor> Descriptors { get; }

    public IRemoteCommandHandler? HandlerFor(RemoteCommandName command)
        => _handlers.TryGetValue(command, out var handler) ? handler : null;
}
