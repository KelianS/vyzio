namespace Vyzio.Core.Entities;

/// <summary>
/// A message on its way out. Streams are owned by the caller, which disposes them once the send returns.
/// </summary>
public sealed record OutgoingNotification(
    ChannelMessage Message,
    Stream? Photo = null,
    Stream? Video = null);
