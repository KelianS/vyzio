using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vyzio.Core.Entities;

/// <summary>Every channel holds its detection notifications until <see cref="Until"/>, or until the user ends it; cameras keep filming and detecting.</summary>
[Table("notification_silence")]
public class NotificationSilence
{
    // The house holds one Silence at most: a fixed id makes "replace it" a primary-key upsert.
    public const string SingletonId = "default";

    [Key, MaxLength(50)]
    public string Id { get; set; } = SingletonId;

    public DateTimeOffset StartedAt { get; set; }

    /// <summary>Null: the Silence holds until the user ends it.</summary>
    public DateTimeOffset? Until { get; set; }

    /// <summary>Whether this moment falls inside the Silence; past <see cref="Until"/> it is over.</summary>
    public bool Covers(DateTimeOffset moment) => moment >= StartedAt && (Until is not { } until || moment < until);
}
