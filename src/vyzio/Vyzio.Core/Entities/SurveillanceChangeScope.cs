namespace Vyzio.Core.Entities;

// What a written-but-not-yet-restarted change touched (ADR-44).
// Coarse on purpose: a domain the user recognises, not a field — the dashboard supplies the wording.
public enum SurveillanceChangeScope
{
    Cameras,
    Detection,
    Retention,
}
