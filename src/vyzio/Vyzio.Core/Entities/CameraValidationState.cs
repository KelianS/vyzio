namespace Vyzio.Core.Entities;

// Where a camera stands: its stream never worked, added but not proven, watched, or on its way out; only a validated one is polled (ADR-23, ADR-68 d).
public enum CameraValidationState
{
    Draft,
    Validated,
    PendingRemoval,
    ToSetUp,
}
