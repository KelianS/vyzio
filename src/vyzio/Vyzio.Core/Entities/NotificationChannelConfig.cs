using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vyzio.Core.Entities;

/// <summary>
/// Everything a channel is configured with: the part every channel shares, and — behind
/// <see cref="Credentials"/> — the part that belongs to the channel alone (ADR-50).
/// </summary>
[Table("notification_channel_configs")]
public class NotificationChannelConfig
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Required]
    public required NotificationChannel Channel { get; set; }

    public bool IsEnabled { get; set; }

    /// <summary>Serialized <see cref="ChannelCredentials"/>; go through <see cref="Credentials"/> instead.</summary>
    public string? CredentialsJson { get; set; }

    [NotMapped]
    public ChannelCredentials Credentials
    {
        get => ChannelCredentials.FromJson(CredentialsJson);
        set => CredentialsJson = value.ToJson();
    }

    // --- When to notify -------------------------------------------------
    public float MinimumConfidence { get; set; } = 0.75f;

    public string? AllowedLabelsJson { get; set; }

    public int? ActiveFromHour { get; set; }

    public int? ActiveToHour { get; set; }

    public int? CooldownMinutes { get; set; }

    // --- What to send ---------------------------------------------------
    public string? MessageFieldsJson { get; set; }

    public MediaMode MediaMode { get; set; } = MediaMode.ClipOrPhoto;

    // --- Trace ----------------------------------------------------------
    public DateTimeOffset? ConfiguredAt { get; set; }

    public DateTimeOffset? LastTestedAt { get; set; }

    public ChannelTestOutcome? LastTestOutcome { get; set; }

    public string? LastTestError { get; set; }
}
