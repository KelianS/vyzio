using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.CapabilityProviders;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Tests.Services;

public class V380PtzProviderTests
{
    private static V380PtzProvider MakeProvider()
    {
        var factory = Substitute.For<IHttpClientFactory>();
        var resolver = new OnvifEndpointResolver(factory, TimeProvider.System, NullLogger<OnvifEndpointResolver>.Instance);
        var onvif = new OnvifClient(factory, resolver, TimeProvider.System, NullLogger<OnvifClient>.Instance);
        return new V380PtzProvider(new V380Client(NullLogger<V380Client>.Instance), onvif,
            new PtzMoveRunner(TimeProvider.System, NullLogger<PtzMoveRunner>.Instance), NullLogger<V380PtzProvider>.Instance);
    }

    [Fact]
    public async Task MoveForAsync_ShouldRaiseThatTheCameraIsUnreachable_WhenThePacketCannotBeSent()
    {
        // Arrange
        var camera = new Camera { Id = "cam", Slug = "cam", FrigateCameraName = "cam", DisplayName = "cam", Host = "127.0.0.1" };
        var binding = new CameraCapabilityBinding
        {
            CameraId = "cam",
            Capability = CameraCapability.Ptz,
            Protocol = SupportedProtocol.V380,
            ConfigJson = """{"device_id":26970853}""",
        };

        await using var motion = await MakeProvider().OpenMotionAsync(camera, binding);

        // Act
        var error = await Assert.ThrowsAsync<CameraUnreachableException>(() => motion.MoveForAsync(PtzDirection.Right, 50, TimeSpan.FromMilliseconds(100)));

        // Assert
        Assert.Contains("127.0.0.1", error.Message, StringComparison.Ordinal);
    }
}
