using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vyzio.Core.Entities;

[Table("profiles")]
public class Profile
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Required, MaxLength(200)]
    public required string Name { get; set; }

    [Required, MaxLength(50)]
    public string Category { get; set; } = "other";  // household|known|delivery|pet|other

    [Required, MaxLength(50)]
    public string AlertMode { get; set; } = "notify"; // notify|silent|ignore

    public DateTimeOffset? LastSeenAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<ProfilePhoto> Photos { get; set; } = [];
    public ICollection<ProfileCameraLink> CameraLinks { get; set; } = [];
}
