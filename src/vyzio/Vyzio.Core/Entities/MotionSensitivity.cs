namespace Vyzio.Core.Entities;

// How readily a camera's scene is considered "moving" (ADR-35). Ordered from most to least
// sensitive, which is the direction the auto-tuning loop steps through.
//
// Deliberately an enum rather than the underlying Frigate value: the two scales run in opposite
// directions (High sensitivity = LOW motion.contour_area), so passing raw integers around would
// invite exactly the kind of inverted-comparison bug the type-safety rule exists to prevent
// (src/vyzio/CLAUDE.md). The translation lives in one place, in the infrastructure layer.
public enum MotionSensitivity
{
    High,
    Medium,
    Low,
}
