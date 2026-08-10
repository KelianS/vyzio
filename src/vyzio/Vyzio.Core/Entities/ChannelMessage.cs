namespace Vyzio.Core.Entities;

/// <summary>
/// What Vyzio has to say, before any channel has had a say in how it looks: a headline and secondary
/// details. The channel renders it, it never composes it — outbound alert or command answer alike (ADR-50).
/// </summary>
public sealed record ChannelMessage(string Headline, IReadOnlyList<string> Details)
{
    public static ChannelMessage Plain(string headline) => new(headline, []);
}
