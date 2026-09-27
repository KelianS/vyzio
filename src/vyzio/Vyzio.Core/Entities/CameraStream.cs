using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vyzio.Core.Entities;

// A video access point of a camera, a row under its stream binding with its own role and check (ADR-38, ADR-65).
// Ranked, not labelled: Ordinal 0 is the most detailed; the interface shows the measured size, never a tier name.
[Table("camera_streams")]
public class CameraStream
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Required]
    public required string BindingId { get; set; }

    public CameraCapabilityBinding? Binding { get; set; }

    // 0 = most detailed as enumerated; a stream declared by hand takes the next free rank.
    public int Ordinal { get; set; }

    public SupportedProtocol Protocol { get; set; }

    // RTSP path, or the DVRIP query suffix. Null is legitimate: some cameras serve at the connection root.
    [MaxLength(500)]
    public string? Path { get; set; }

    // Real pixels as reported; null when the protocol gave no exact size (DVRIP nominal labels, ADR-38).
    public int? Width { get; set; }

    public int? Height { get; set; }

    public int? Fps { get; set; }

    // Changed only through StreamLineup, which holds the one-recording-stream guard (ADR-65).
    public StreamRole Role { get; set; }

    public bool Enabled { get; set; } = true;

    public bool Verified { get; set; }

    public DateTimeOffset? CheckedAt { get; set; }

    public string? LastError { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public bool HasKnownResolution => Width is > 0 && Height is > 0;

    public bool Records => Enabled && Role.Records();

    public bool Detects => Enabled && Role.Detects();
}
