using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface ICameraVerifier
{
    Task<CameraVerificationResult> VerifyAsync(Camera camera, CancellationToken ct = default);
}