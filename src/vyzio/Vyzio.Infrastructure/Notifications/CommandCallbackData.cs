using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.Notifications;

/// <summary>
/// What travels inside a button, in the same shape whichever channel draws it. Telegram allows 64
/// bytes there, the tighter of the two limits, so it holds the verb, whether the tap confirms, and
/// the arguments in the order the command declares them — nothing else fits.
/// </summary>
internal static class CommandCallbackData
{
    private const char Separator = '|';

    public static string Write(RemoteCommandDescriptor descriptor, CommandFollowUp followUp)
    {
        var arguments = descriptor.Parameters.Select(parameter =>
            followUp.Arguments is not null && followUp.Arguments.TryGetValue(parameter.Name, out var value)
                ? value
                : string.Empty);

        return string.Join(Separator, [descriptor.Verb, followUp.Confirms ? "1" : "0", .. arguments]);
    }

    public static IncomingMessage? Read(
        string? data,
        CommandOrigin origin,
        IReadOnlyList<RemoteCommandDescriptor> commands)
    {
        if (string.IsNullOrEmpty(data)) return null;

        var parts = data.Split(Separator);
        if (parts.Length < 2) return null;

        var descriptor = commands.FirstOrDefault(candidate => candidate.Answers(parts[0]));
        if (descriptor is null) return new IncomingMessage(origin, Command: null);

        var arguments = new Dictionary<string, string>();
        for (var index = 0; index < descriptor.Parameters.Count && index + 2 < parts.Length; index++)
        {
            if (parts[index + 2].Length > 0) arguments[descriptor.Parameters[index].Name] = parts[index + 2];
        }

        return new IncomingMessage(origin, descriptor.Name, arguments, Confirmed: parts[1] == "1");
    }
}
