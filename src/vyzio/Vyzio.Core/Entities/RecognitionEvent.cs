using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vyzio.Core.Entities;

[Table("recognition_events")]
public class RecognitionEvent
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Required, MaxLength(100)]
    public required string FrigateEventId { get; set; }

    [Required, MaxLength(200)]
    public required string CameraName { get; set; }

    /// <summary>face_known | face_unknown | face_uncertain | motion_only</summary>
    [Required, MaxLength(50)]
    public required string RecognitionType { get; set; }

    [MaxLength(100)]
    public string? ProfileId { get; set; }

    [MaxLength(200)]
    public string? ProfileName { get; set; }

    public float? Confidence { get; set; }

    public byte[]? ThumbnailJpeg { get; set; }

    public DateTimeOffset OccurredAt { get; set; } = DateTimeOffset.UtcNow;

    public bool Notified { get; set; }

    [ForeignKey(nameof(ProfileId))]
    public Profile? Profile { get; set; }
}
