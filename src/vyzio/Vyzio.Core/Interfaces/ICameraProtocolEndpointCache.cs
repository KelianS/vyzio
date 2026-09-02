namespace Vyzio.Core.Interfaces;

// Where a camera answers a protocol is resolved once and remembered, in memory and on the camera
// (ADR-56). A camera changes: a service gets enabled in the vendor app, a firmware moves a port.
// This is how an explicit user gesture ("check this camera again") drops what was remembered, so
// the next call resolves from scratch instead of trusting an answer that has gone stale.
public interface ICameraProtocolEndpointCache
{
    void Forget(string cameraId);
}
