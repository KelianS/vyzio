namespace Vyzio.Core.Entities;

/// <summary>
/// How the details hold together — intent, not markup: the channel still decides what it looks like.
/// </summary>
public enum ChannelMessageLayout
{
    /// <summary>Short facts about one thing: camera, hour, certainty.</summary>
    Inline,

    /// <summary>A list whose items are read one by one, such as what one may ask for.</summary>
    OnePerLine
}

/// <summary>
/// What Vyzio has to say, before any channel has had a say in how it looks: a headline and secondary
/// details. The channel renders it, it never composes it — outbound alert or command answer alike (ADR-50).
/// </summary>
public sealed record ChannelMessage(
    string Headline,
    IReadOnlyList<string> Details,
    ChannelMessageLayout Layout = ChannelMessageLayout.Inline)
{
    public static ChannelMessage Plain(string headline) => new(headline, []);

    public static ChannelMessage List(string headline, IReadOnlyList<string> items)
        => new(headline, items, ChannelMessageLayout.OnePerLine);
}
