using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

/// <summary>
/// One implementation per channel, and nothing above it knows which one it holds (ADR-50).
/// </summary>
public interface INotificationChannelSender
{
    NotificationChannelDescriptor Descriptor { get; }

    Task SendAsync(OutgoingNotification notification, ChannelCredentials credentials, CancellationToken ct = default);
}

/// <summary>Resolves the channel to its adapter; the only place that knows the full list.</summary>
public interface INotificationChannelCatalog
{
    IReadOnlyList<NotificationChannelDescriptor> Descriptors { get; }

    NotificationChannelDescriptor? Describe(NotificationChannel channel);

    INotificationChannelSender? SenderFor(NotificationChannel channel);
}
