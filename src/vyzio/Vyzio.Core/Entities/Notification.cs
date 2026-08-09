using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vyzio.Core.Entities;

[Table("notifications")]
public class Notification
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Required, MaxLength(100)]
    public required string FrigateEventId { get; set; }

    [Required, MaxLength(50)]
    public required string Channel { get; set; }

    [Required, MaxLength(200)]
    public required string Camera { get; set; }

    [Required, MaxLength(50)]
    public required string Label { get; set; }

    [Required, MaxLength(50)]
    public required string Status { get; set; }  // sent|failed

    public DateTimeOffset SentAt { get; set; } = DateTimeOffset.UtcNow;

    public string? ErrorMessage { get; set; }
}
