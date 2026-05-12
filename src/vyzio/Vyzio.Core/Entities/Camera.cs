using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vyzio.Core.Entities;

[Table("cameras")]
public class Camera
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Required, MaxLength(100)]
    public required string Slug { get; set; }

    [Required, MaxLength(200)]
    public required string DisplayName { get; set; }

    [Required, MaxLength(50)]
    public string SourceType { get; set; } = "rtsp_manual";

    [Required, MaxLength(200)]
    public required string Host { get; set; }

    public int Port { get; set; }

    [MaxLength(200)]
    public string? Username { get; set; }

    [MaxLength(500)]
    public string? Password { get; set; }

    [MaxLength(500)]
    public string? StreamPath { get; set; }

    [Required, MaxLength(50)]
    public string DetectionPreset { get; set; } = "person_default";

    [Required, MaxLength(50)]
    public string Status { get; set; } = "needs_attention";

    public DateTimeOffset? LastReachabilityCheckAt { get; set; }

    public DateTimeOffset? LastSuccessfulFrameAt { get; set; }

    [MaxLength(200)]
    public string? FrigateCameraName { get; set; }

    [Required, MaxLength(50)]
    public string ValidationState { get; set; } = "draft";

    public bool IsEnabled { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}