using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vyzio.Core.Entities;

[Table("profile_camera_links")]
public class ProfileCameraLink
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Required, MaxLength(100)]
    public required string ProfileId { get; set; }

    [Required, MaxLength(100)]
    public required string CameraId { get; set; }

    public bool Enabled { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    [ForeignKey(nameof(ProfileId))]
    public Profile? Profile { get; set; }

    [ForeignKey(nameof(CameraId))]
    public Camera? Camera { get; set; }
}
