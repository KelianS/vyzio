using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vyzio.Core.Entities;

/// <summary>Every channel holds its detection notifications until <see cref="Until"/>; cameras keep filming and detecting.</summary>
[Table("notification_silence")]
public class NotificationSilence
{
    // The house holds one Silence at most: a fixed id makes "replace it" a primary-key upsert.
    public const string SingletonId = "default";

    [Key, MaxLength(50)]
    public string Id { get; set; } = SingletonId;

    public DateTimeOffset StartedAt { get; set; }

    public DateTimeOffset Until { get; set; }

    /// <summary>Whether this moment falls inside the Silence; past <see cref="Until"/> it is over.</summary>
    public bool Covers(DateTimeOffset moment) => moment >= StartedAt && moment < Until;
}

/// <summary>What the user must change for a Silence to start.</summary>
public enum SilenceRefusal
{
    /// <summary>Neither an end instant nor a duration, or both.</summary>
    NoSingleEnd,

    /// <summary>The end is not after now.</summary>
    EndNotAhead,

    /// <summary>The end lies beyond the week a Silence may last.</summary>
    TooLong,
}
