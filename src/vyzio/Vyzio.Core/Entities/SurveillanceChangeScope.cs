namespace Vyzio.Core.Entities;

// What a written-but-not-yet-restarted change touched (ADR-44). The user decides when surveillance
// restarts, so the wait has to say *what* is waiting — "des modifications en attente" alone is the
// opaque state the product forbids.
//
// Deliberately coarse: a scope is a domain the user recognises, not a field. Naming individual
// settings here would put interface vocabulary in the application layer and force this enum to
// track every setting ever added; the dashboard maps these few scopes to its own wording.
public enum SurveillanceChangeScope
{
    // Adding, editing or removing a camera.
    Cameras,

    // What a camera looks for, and with which image.
    Detection,

    // How long recordings are kept.
    Retention,
}
