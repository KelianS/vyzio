using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vyzio.Core.Entities;

// A video access point of a camera (ADR-38) — the single home for stream paths, which used to live
// as a lone Camera.StreamPath column.
//
// Streams are ranked, not labelled: Ordinal 0 is the most detailed one the camera serves, and each
// following rank is lighter. A rank carries no vocabulary of its own — the interface shows the real
// resolution and frame rate, never an invented tier name. This also lets a camera expose any number
// of streams; a two-value quality enum silently lost the third.
[Table("camera_streams")]
public class CameraStream
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Required]
    public required string CameraId { get; set; }

    public Camera? Camera { get; set; }

    // 0 = most detailed. Assigned by enumeration, in descending resolution order.
    public int Ordinal { get; set; }

    // RTSP path for Rtsp cameras, protocol query suffix for Dvrip ones. Null is legitimate:
    // some cameras serve their stream at the connection root.
    [MaxLength(500)]
    public string? Path { get; set; }

    // What the camera reported at enumeration time, in real pixels. Null means the protocol did not
    // expose it (DVRIP reports unreliable nominal labels), never "unknown resolution 0".
    public int? Width { get; set; }

    public int? Height { get; set; }

    public int? Fps { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public bool HasKnownResolution => Width is > 0 && Height is > 0;
}
