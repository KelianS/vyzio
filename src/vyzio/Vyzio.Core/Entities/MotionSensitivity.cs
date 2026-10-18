namespace Vyzio.Core.Entities;

// How readily a camera's scene is considered "moving" (ADR-35). Ordered from most to least
// sensitive, which is the direction the auto-tuning loop steps through.
// An enum, not Frigate's value: the two scales run in opposite directions, translated once in infrastructure (COMMON-04).
public enum MotionSensitivity
{
    High,
    Medium,
    Low,
}
