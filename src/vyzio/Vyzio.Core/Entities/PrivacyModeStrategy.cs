namespace Vyzio.Core.Entities;

// Per-camera privacy mode strategy, protocol-agnostic by design (ADR-21).
public enum PrivacyModeStrategy
{
    Software,
    PtzParking,
    Hardware,
}
