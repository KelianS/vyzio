using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface ICameraVerifier
{
    // stream: the one to verify, null for a camera whose stream protocol was never chosen (ADR-07).
    Task<CameraVerificationResult> VerifyAsync(Camera camera, CameraStream? stream, CancellationToken ct = default);
}
