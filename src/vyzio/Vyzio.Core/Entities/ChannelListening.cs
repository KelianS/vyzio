namespace Vyzio.Core.Entities;

/// <summary>
/// Whether a channel is still listening for commands, and since when. No persisted value can say it:
/// the retrieval loop lives in memory, and losing the network leaves the saved configuration intact
/// (ADR-52).
/// </summary>
/// <param name="Reason">What broke the loop, in the words of whoever broke it — kept even once it is
/// listening again, because that is the only trace of a channel that comes and goes.</param>
public sealed record ChannelListening(
    bool Listening,
    DateTimeOffset? Since,
    DateTimeOffset? InterruptedAt,
    string? Reason)
{
    /// <summary>No loop at all: the channel is off, or was never configured to listen.</summary>
    public static ChannelListening Off { get; } = new(false, null, null, null);
}
