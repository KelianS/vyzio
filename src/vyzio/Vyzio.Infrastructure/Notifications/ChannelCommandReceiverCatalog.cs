using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Notifications;

/// <summary>The only place that holds the list of channels able to listen; the others simply are not in it.</summary>
public sealed class ChannelCommandReceiverCatalog : IChannelCommandReceiverCatalog
{
    private readonly Dictionary<NotificationChannel, IChannelCommandReceiver> _receivers;

    public ChannelCommandReceiverCatalog(IEnumerable<IChannelCommandReceiver> receivers)
        => _receivers = receivers.ToDictionary(receiver => receiver.Channel);

    public IChannelCommandReceiver? ReceiverFor(NotificationChannel channel)
        => _receivers.TryGetValue(channel, out var receiver) ? receiver : null;
}
