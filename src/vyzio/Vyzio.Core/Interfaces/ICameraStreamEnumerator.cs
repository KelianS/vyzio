using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

// One stream reported by the camera, before it is persisted as a CameraStream. Carries no rank of
// its own: its position in EnumeratedScene.Streams is the rank, most detailed first.
public sealed record EnumeratedStream(string? Path, int? Width, int? Height, int? Fps);

// A distinct scene the device films. A single-lens camera reports exactly one; a multi-lens box
// reports one per lens (ADR-38). SceneKey is whatever the protocol uses to tell them apart — the
// ONVIF VideoSource token — and is opaque to Vyzio beyond grouping.
public sealed record EnumeratedScene(string SceneKey, IReadOnlyList<EnumeratedStream> Streams);

// Asks a camera what video streams it actually serves (ADR-38). Never throws on an unreachable or
// uncooperative camera: an empty result means "could not enumerate", which callers must treat as
// "keep the single stream we already have", not as an error.
public interface ICameraStreamEnumerator
{
    Task<IReadOnlyList<EnumeratedScene>> EnumerateAsync(Camera camera, CancellationToken ct = default);
}
