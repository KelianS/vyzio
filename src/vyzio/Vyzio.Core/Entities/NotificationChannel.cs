namespace Vyzio.Core.Entities;

/// <summary>A messaging channel Vyzio can talk through. No channel has a special status (ADR-50).</summary>
public enum NotificationChannel
{
    Telegram,
    Discord
}

/// <summary>A secret or address a channel needs; each channel declares which ones apply to it.</summary>
public enum ChannelCredential
{
    BotToken,

    /// <summary>The conversation Vyzio writes into — a Telegram chat, a Discord room (ADR-52).</summary>
    ChatId
}

/// <summary>What the user chose to receive, independently of what the channel can carry.</summary>
public enum MediaMode
{
    ClipOrPhoto,
    Photo,
    Text
}

public enum NotificationStatus
{
    Sent,
    Failed
}

public enum ChannelTestOutcome
{
    Success,
    Failure
}

/// <summary>A piece of a detection the user chose to see in the message.</summary>
public enum MessageField
{
    Camera,
    Time,
    Label,
    Confidence,
    Snapshot
}
