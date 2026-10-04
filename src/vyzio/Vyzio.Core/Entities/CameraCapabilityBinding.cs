using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vyzio.Core.Entities;

// Links a camera to the protocol that implements one of its optional capabilities (ADR-22).
// Replaces the scattered booleans (PtzSupported, PrivacyVendorCut) as the source of truth for
// whether a capability is actually usable — Verified is only ever set by a real probe, never
// by declaration alone.
[Table("camera_capability_bindings")]
public class CameraCapabilityBinding
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Required]
    public required string CameraId { get; set; }

    public Camera? Camera { get; set; }

    public CameraCapability Capability { get; set; }

    public SupportedProtocol Protocol { get; set; }

    // The capability's own settings (BindingConfig); how to reach the protocol is on CameraProtocol (ADR-61).
    public string? ConfigJson { get; set; }

    // Result of the last check or of the user's answer, never set declaratively (ADR-66).
    public CapabilityStatus Status { get; set; }

    // Usable: proven, or confirmed by the user; read from Status, never written.
    [NotMapped]
    public bool Verified => Status == CapabilityStatus.Verified;

    // When the user confirmed the capability over this protocol; kept across checks, cleared by a proof, a protocol change or a "no".
    public DateTimeOffset? ConfirmedAt { get; set; }

    // When the user answered "no" over this protocol; only a proof, a protocol change or their "yes" clears it (ADR-66 c).
    public DateTimeOffset? RejectedAt { get; set; }

    // True when the protocol was picked explicitly by the user (manual configure/edit path,
    // ADR-28) rather than seeded from a vendor preset. SeedAndProbePresetsUseCase must never
    // overwrite a manually-chosen protocol when re-running detection.
    public bool ManuallyConfigured { get; set; }

    public DateTimeOffset? VerifiedAt { get; set; }

    public string? LastError { get; set; }

    // The stream capability's streams (ADR-65); empty for every other capability.
    public ICollection<CameraStream> Streams { get; set; } = [];

    // When the stream capability found its streams; empty until then, so later checks never re-add one (ADR-65).
    public DateTimeOffset? StreamsFoundAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
