namespace Vyzio.Core.Interfaces;

// How a user gesture drops the remembered address of a camera that changed since (ADR-56).
public interface ICameraProtocolEndpointCache
{
    void Forget(string cameraId);
}
