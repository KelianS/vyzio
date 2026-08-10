namespace Vyzio.Core.Entities;

/// <summary>
/// What Vyzio has to say, before any channel has had a say in how it looks: a headline, secondary
/// details, and the media that go with it. The channel renders it, it never composes it (ADR-50).
/// </summary>
public sealed record NotificationMessage(string Headline, IReadOnlyList<string> Details)
{
    public static NotificationMessage Plain(string headline) => new(headline, []);
}

/// <summary>
/// A message on its way out. Streams are owned by the caller, which disposes them once the send returns.
/// </summary>
public sealed record OutgoingNotification(
    NotificationMessage Message,
    Stream? Photo = null,
    Stream? Video = null);
