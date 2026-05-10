using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vyzio.Core.Entities;

[Table("observed_events")]
public class DetectionEvent
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Required, MaxLength(100)]
    public required string FrigateEventId { get; set; }

    [Required, MaxLength(20)]
    public required string Lifecycle { get; set; }

    [Required, MaxLength(200)]
    public required string Camera { get; set; }

    [Required, MaxLength(50)]
    public required string Label { get; set; }

    [MaxLength(200)]
    public string? Identity { get; set; }

    [MaxLength(100)]
    public string? ProfileId { get; set; }

    public float? Confidence { get; set; }

    public DateTimeOffset OccurredAt { get; set; } = DateTimeOffset.UtcNow;

    public bool HasClip { get; set; }

    public bool HasSnapshot { get; set; }

    [ForeignKey(nameof(ProfileId))]
    public Profile? Profile { get; set; }
}
