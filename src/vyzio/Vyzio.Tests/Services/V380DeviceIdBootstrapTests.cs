using Microsoft.Extensions.Logging.Abstractions;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Tests.Services;

public class V380DeviceIdBootstrapTests
{
    private static Camera MakeCamera() => new()
    {
        Id = "cam1",
        Slug = "cam1",
        FrigateCameraName = "cam1",
        DisplayName = "cam1",
        Host = "192.168.1.20",
    };

    [Fact]
    public void PersistIfDiscovered_ShouldKeepTheDeviceIdOnTheV380Protocol_WhenTheClientFoundIt()
    {
        // Arrange
        var client = new V380Client(NullLogger<V380Client>.Instance);
        client.PreloadDeviceId("192.168.1.20", 26970853);
        var camera = MakeCamera();

        // Act
        V380DeviceIdBootstrap.PersistIfDiscovered(camera, client);

        // Assert
        Assert.Equal(26970853u, camera.Protocol(SupportedProtocol.V380)?.DeviceId);
    }

    [Fact]
    public void PreloadStored_ShouldHandTheTypedNumberToTheClient_WhenTheV380ProtocolHoldsOne()
    {
        // Arrange
        var client = new V380Client(NullLogger<V380Client>.Instance);
        var camera = MakeCamera();
        camera.EnsureProtocol(SupportedProtocol.V380).DeviceId = 12345678;

        // Act
        V380DeviceIdBootstrap.PreloadStored(camera, client);

        // Assert
        Assert.Equal(12345678u, client.GetCachedDeviceId("192.168.1.20"));
    }
}
