namespace Vyzio.Core.Interfaces;

// The camera answered, and said no. Distinct from a camera that cannot be reached: a refusal
// carries a reason the user can act on (privacy mode on, credentials rejected, feature locked),
// so it must reach the interface instead of being swallowed as a silent no-op (ADR-56).
public class CameraCommandRefusedException(string message, Exception? inner = null)
    : Exception(message, inner);
