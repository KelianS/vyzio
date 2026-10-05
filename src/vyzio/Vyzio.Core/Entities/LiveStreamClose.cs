namespace Vyzio.Core.Entities;

// The close codes a live socket ends with, named by the interface (ADR-72 b).
public enum LiveStreamClose
{
    UnknownCamera = 4404,
    PrivacyMode = 4409,
    NoStream = 4422,
    Unreachable = 4503,
}
