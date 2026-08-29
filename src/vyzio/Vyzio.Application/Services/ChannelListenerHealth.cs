using System.Collections.Concurrent;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.Services;

/// <summary>
/// In memory, and deliberately: this state dies with the process, exactly like the loops it describes.
/// Persisting it would let Vyzio claim after a restart that it is listening when nothing is (ADR-52).
/// </summary>
internal sealed class ChannelListenerHealth : IChannelListenerHealth
{
    private readonly ConcurrentDictionary<NotificationChannel, ChannelListening> _states = new();

    public void Started(NotificationChannel channel)
        => _states.AddOrUpdate(
            channel,
            _ => new ChannelListening(true, DateTimeOffset.UtcNow, null, null),
            // Since is when it started listening, not when it was last heard from: a round that comes
            // back is the same uninterrupted loop.
            (_, current) => current.Listening
                ? current
                : current with { Listening = true, Since = DateTimeOffset.UtcNow });

    public void Interrupted(NotificationChannel channel, string reason)
        => _states[channel] = new ChannelListening(false, null, DateTimeOffset.UtcNow, reason);

    public void Stopped(NotificationChannel channel) => _states.TryRemove(channel, out _);

    public ChannelListening StateOf(NotificationChannel channel)
        => _states.TryGetValue(channel, out var state) ? state : ChannelListening.Off;
}
