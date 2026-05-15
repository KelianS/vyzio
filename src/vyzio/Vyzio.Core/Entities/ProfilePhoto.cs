using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vyzio.Core.Entities;

[Table("profile_photos")]
public class ProfilePhoto
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Required, MaxLength(100)]
    public required string ProfileId { get; set; }

    [Required, MaxLength(300)]
    public required string Filename { get; set; }

    public bool FrigateSynced { get; set; }

    public DateTimeOffset? SyncedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    [ForeignKey(nameof(ProfileId))]
    public Profile? Profile { get; set; }
}
