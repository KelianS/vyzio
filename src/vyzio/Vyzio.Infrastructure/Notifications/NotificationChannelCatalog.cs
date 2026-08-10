using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Notifications;

/// <summary>The only place that holds the list of channels; adding one is a registration, not an edit elsewhere.</summary>
public sealed class NotificationChannelCatalog : INotificationChannelCatalog
{
    private readonly Dictionary<NotificationChannel, INotificationChannelSender> _senders;

    public NotificationChannelCatalog(IEnumerable<INotificationChannelSender> senders)
    {
        _senders = senders.ToDictionary(sender => sender.Descriptor.Channel);
        Descriptors = [.. _senders.Values.Select(sender => sender.Descriptor)];
    }

    public IReadOnlyList<NotificationChannelDescriptor> Descriptors { get; }

    public NotificationChannelDescriptor? Describe(NotificationChannel channel)
        => SenderFor(channel)?.Descriptor;

    public INotificationChannelSender? SenderFor(NotificationChannel channel)
        => _senders.TryGetValue(channel, out var sender) ? sender : null;
}
