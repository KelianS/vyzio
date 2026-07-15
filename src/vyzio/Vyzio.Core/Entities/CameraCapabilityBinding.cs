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

    // Protocol-specific connection parameters (ONVIF port/address, DVRIP credentials, etc.)
    public string? ConfigJson { get; set; }

    // Result of the last real probe — never set declaratively.
    public bool Verified { get; set; }

    // True when the protocol was picked explicitly by the user (manual configure/edit path,
    // ADR-28) rather than seeded from a vendor preset. SeedAndProbePresetsUseCase must never
    // overwrite a manually-chosen protocol when re-running detection.
    public bool ManuallyConfigured { get; set; }

    public DateTimeOffset? VerifiedAt { get; set; }

    public string? LastError { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
