using Vyzio.Core.Entities;

namespace Vyzio.Tests;

internal static class TestCameras
{
    // Gives a camera its stream capability the way onboarding does: binding, protocol row, main path (ADR-61).
    public static Camera WithStream(this Camera camera, SupportedProtocol protocol, int? port = null, string? path = null)
    {
        var binding = new CameraCapabilityBinding
        {
            CameraId = camera.Id,
            Capability = CameraCapability.Stream,
            Protocol = protocol,
            ManuallyConfigured = true,
        };
        camera.Capabilities.Add(binding);
        camera.EnsureProtocol(protocol).Port = port;
        StreamLineup.ResetTo(binding, protocol, path);
        return camera;
    }
}
