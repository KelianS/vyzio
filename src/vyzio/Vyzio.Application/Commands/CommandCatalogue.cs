using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.Commands;

/// <summary>
/// What one may ask, said in the conversation itself. The registry is the source; nobody maintains a
/// second list of commands anywhere (ADR-50).
/// </summary>
public static class CommandCatalogue
{
    public static ChannelMessage Describe(IRemoteCommandRegistry registry, string headline)
    {
        ArgumentNullException.ThrowIfNull(registry);

        var offered = registry.Descriptors
            // Pairing is how a conversation gets in; once in, it is noise.
            .Where(descriptor => descriptor.Authorization != CommandAuthorization.Pairing)
            .Select(Line)
            .ToList();

        return offered.Count > 0
            ? ChannelMessage.List(headline, offered)
            : ChannelMessage.Plain(headline);
    }

    private static string Line(RemoteCommandDescriptor descriptor)
    {
        var parameters = string.Concat(descriptor.Parameters.Select(parameter =>
            parameter.Required ? $" <{parameter.Name}>" : $" [{parameter.Name}]"));

        return $"/{descriptor.Verb}{parameters} — {descriptor.Description}";
    }
}
