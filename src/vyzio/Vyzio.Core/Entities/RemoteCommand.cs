namespace Vyzio.Core.Entities;

/// <summary>A command Vyzio accepts from a messaging channel. Declared once, whatever carries it (ADR-50).</summary>
public enum RemoteCommandName
{
    SystemState,
    Pair,
    Help,
    Snapshot,
    RecentDetections,
    PrivacyMode,
    PtzPosition
}

/// <summary>The shape of a parameter, so the channel can validate it before Vyzio ever sees it (ADR-52).</summary>
public enum CommandParameterKind
{
    Camera,
    Text,
    Number
}

/// <summary>Who may run a command, and at what price.</summary>
public enum CommandAuthorization
{
    /// <summary>Any paired conversation may run it.</summary>
    Paired,

    /// <summary>Consequential enough to require an explicit confirmation in the thread first (ADR-50).</summary>
    PairedAndConfirmed,

    /// <summary>The one thing a conversation may do before being paired — it is how it gets paired (ADR-50).</summary>
    Pairing
}

public sealed record RemoteCommandParameter(
    string Name,
    CommandParameterKind Kind,
    bool Required,
    string Description);

/// <summary>Everything a channel needs to publish and route a command without knowing what it does.</summary>
/// <param name="Verb">
/// The word one types in the conversation. Product vocabulary, in the user's language — never the
/// internal name, which would put jargon in front of someone who never asked for it (principe #1).
/// </param>
public sealed record RemoteCommandDescriptor(
    RemoteCommandName Name,
    string Verb,
    string Description,
    CommandAuthorization Authorization,
    IReadOnlyList<RemoteCommandParameter> Parameters)
{
    public static RemoteCommandDescriptor Consultation(RemoteCommandName name, string verb, string description)
        => new(name, verb, description, CommandAuthorization.Paired, []);

    public bool Answers(string verb) => string.Equals(Verb, verb, StringComparison.OrdinalIgnoreCase);
}
