using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

/// <summary>
/// The health of the retrieval loops, written by whoever runs them and read by the settings screen.
/// Reads and writes share one interface because they share one truth, held only in memory.
/// </summary>
public interface IChannelListenerHealth
{
    /// <summary>Listening as of now — called when the loop starts, and again on each round that comes back.</summary>
    void Started(NotificationChannel channel);

    /// <summary>The loop broke; it retries on its own, but until it comes back the channel hears nothing.</summary>
    void Interrupted(NotificationChannel channel, string reason);

    /// <summary>The loop was taken down on purpose — the channel was disabled or reconfigured.</summary>
    void Stopped(NotificationChannel channel);

    ChannelListening StateOf(NotificationChannel channel);
}
