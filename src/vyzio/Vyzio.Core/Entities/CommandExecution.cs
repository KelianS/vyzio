namespace Vyzio.Core.Entities;

/// <summary>
/// Where a command came from. The conversation, not the channel, is what gets paired — and what gets
/// revoked (ADR-50).
/// </summary>
public sealed record CommandOrigin(NotificationChannel Channel, string ConversationId);

/// <summary>A command as received, before anything has been decided about it.</summary>
public sealed record CommandInvocation(
    RemoteCommandName Command,
    CommandOrigin Origin,
    IReadOnlyDictionary<string, string>? Arguments = null)
{
    public string? Argument(string name)
        => Arguments is not null && Arguments.TryGetValue(name, out var value) ? value : null;
}

/// <summary>A command the answer proposes next; the channel turns it into a button or into text.</summary>
public sealed record CommandFollowUp(
    string Label,
    RemoteCommandName Command,
    IReadOnlyDictionary<string, string>? Arguments = null);

/// <summary>
/// The answer to a command, in the same rendering-free form as an outgoing alert. The photo stream is
/// owned by the caller, which disposes it once the channel has rendered it (ADR-50).
/// </summary>
public sealed record CommandResult(
    ChannelMessage Message,
    Stream? Photo = null,
    IReadOnlyList<CommandFollowUp>? FollowUps = null)
{
    public static CommandResult Text(string headline, IReadOnlyList<string> details)
        => new(new ChannelMessage(headline, details));
}

/// <summary>How a received command ended. Kept even when nothing was answered (ADR-50).</summary>
public enum CommandOutcome
{
    Succeeded,
    Failed
}
