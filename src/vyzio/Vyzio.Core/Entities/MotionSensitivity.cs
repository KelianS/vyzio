namespace Vyzio.Core.Entities;

// Most to least sensitive, the tuner's step order; an enum since Frigate's scale runs the other way (ADR-35).
public enum MotionSensitivity
{
    High,
    Medium,
    Low,
}
