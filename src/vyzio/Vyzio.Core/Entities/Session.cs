using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vyzio.Core.Entities;

[Table("sessions")]
public class Session
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Required, MaxLength(100)]
    public required string UserId { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset ExpiresAt { get; set; }

    public bool Revoked { get; set; }
}
