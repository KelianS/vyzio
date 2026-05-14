namespace Vyzio.Core.Entities;

public sealed record CameraVerificationResult(
    bool Connected,
    bool PreviewAvailable,
    string Status,
    string Guidance,
    DateTimeOffset CheckedAt,
    DateTimeOffset? LastSuccessfulFrameAt);