namespace Vyzio.Core.Interfaces;

// A camera command that did not go through; its message is support detail, never a secret (SPECS 1.5).
public abstract class CameraCommandException(string message, Exception? inner) : Exception(message, inner);

// The camera answered, and said no: privacy mode on, credentials rejected, a malformed answer (ADR-56).
public sealed class CameraCommandRefusedException(string message, Exception? inner = null)
    : CameraCommandException(message, inner);

// The camera could not be reached, or no service answered where it was looked for (ADR-56).
public sealed class CameraUnreachableException(string message, Exception? inner = null)
    : CameraCommandException(message, inner);
