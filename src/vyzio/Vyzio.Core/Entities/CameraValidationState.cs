namespace Vyzio.Core.Entities;

// Where a camera stands: added but not proven, watched, or on its way out; only a validated one is polled (ADR-23).
public enum CameraValidationState
{
    Draft,
    Validated,
    PendingRemoval,
}
