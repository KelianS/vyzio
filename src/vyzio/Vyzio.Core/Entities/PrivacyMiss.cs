namespace Vyzio.Core.Entities;

// Why the camera's part of the last privacy toggle is not confirmed, so the screen says it (PRIV-05).
public enum PrivacyMiss
{
    PositionMissing,
    CapabilityUnverified,
    CameraFailed,
    // The request was cut before the camera answered: Vyzio does not know what it did.
    Unconfirmed,
}
