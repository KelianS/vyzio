using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vyzio.Core.Entities;

[Table("notification_channel_configs")]
public class NotificationChannelConfig
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Required, MaxLength(50)]
    public required string Channel { get; set; } // "telegram"

    public bool IsEnabled { get; set; }

    [MaxLength(500)]
    public string? BotToken { get; set; }

    [MaxLength(100)]
    public string? ChatId { get; set; }

    public float MinimumConfidence { get; set; } = 0.75f;

    /// <summary>JSON array of allowed detection labels. Null means default ["person"].</summary>
    [MaxLength(500)]
    public string? AllowedLabelsJson { get; set; }

    /// <summary>Local hour (0-23) from which notifications are active. Null means no restriction.</summary>
    public int? ActiveFromHour { get; set; }

    /// <summary>Local hour (0-23, exclusive) until which notifications are active. Null means no restriction.</summary>
    public int? ActiveToHour { get; set; }

    /// <summary>JSON array of enabled message fields. Null means all fields enabled.</summary>
    [MaxLength(200)]
    public string? MessageFieldsJson { get; set; }

    /// <summary>Media format for Telegram notifications: "clip_or_photo" (default), "photo", or "text".</summary>
    [MaxLength(20)]
    public string? MediaMode { get; set; }

    public DateTimeOffset? ConfiguredAt { get; set; }

    public DateTimeOffset? LastTestedAt { get; set; }

    [MaxLength(50)]
    public string? LastTestStatus { get; set; } // "success" | "failure"

    public string? LastTestError { get; set; }

    public bool HasCredentials =>
        !string.IsNullOrWhiteSpace(BotToken) && !string.IsNullOrWhiteSpace(ChatId);
}
