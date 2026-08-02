using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vyzio.Core.Entities;

// Installation-wide recording retention (ADR-39). A single row: these are the values a camera
// follows unless it overrides them, which mirrors how Frigate itself is configured — `record:` at
// the root, `cameras.<name>.record:` on top.
//
// Typed on purpose rather than a generic key/value settings table: a key/value store would give up
// compile-time types and force string comparisons, which the backend rules forbid.
[Table("recording_settings")]
public class RecordingSettings
{
    // There is exactly one row. A fixed id makes "read it or create it" a primary-key lookup rather
    // than a table scan with a race on first write.
    public const string SingletonId = "default";

    [Key, MaxLength(50)]
    public string Id { get; set; } = SingletonId;

    // Days of complete footage, recorded whether or not anything happens. Zero by default: this is
    // the only window whose disk cost grows with time passing rather than with what occurs, so it
    // stays a deliberate choice (ADR-39, and the spirit of ADR-18).
    public int ContinuousDays { get; set; }

    // Days of footage kept only where the image moves.
    public int MotionDays { get; set; } = DefaultMotionDays;

    // Days of clips attached to a detection — what the history page shows.
    public int EventClipDays { get; set; } = DefaultEventClipDays;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public const int DefaultContinuousDays = 0;
    public const int DefaultMotionDays = 7;
    public const int DefaultEventClipDays = 14;

    public static RecordingSettings CreateDefault() => new();
}
