using Vyzio.Core.Common;
using Vyzio.Core.Entities;

namespace Vyzio.Application.DTOs.Notifications;

/// <summary>
/// What the settings screen shows of the retrieval loop. The reason is handed back as the channel
/// worded it: paraphrasing a network failure loses the only clue there is.
/// </summary>
public sealed record ChannelListeningDto(
    string Channel,
    bool Listening,
    DateTimeOffset? Since,
    DateTimeOffset? InterruptedAt,
    string? Reason)
{
    public static ChannelListeningDto From(NotificationChannel channel, ChannelListening state)
    {
        ArgumentNullException.ThrowIfNull(state);

        return new ChannelListeningDto(
            SnakeCaseEnum.ToSnakeCase(channel),
            state.Listening,
            state.Since,
            state.InterruptedAt,
            state.Reason);
    }
}
