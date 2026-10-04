using Microsoft.Extensions.Logging.Abstractions;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.CapabilityProviders;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Tests.Services;

public class V380PtzProviderTests
{
    private static V380PtzProvider MakeProvider()
        => new(new V380Client(NullLogger<V380Client>.Instance),
            new PtzMoveRunner(TimeProvider.System, NullLogger<PtzMoveRunner>.Instance), NullLogger<V380PtzProvider>.Instance);

    [Fact]
    public async Task ProveAsync_ShouldLeavePtzToConfirmWithoutAskingTheCamera_WhenTheProtocolAnswered()
    {
        // Arrange
        var camera = new Camera { Id = "cam", Slug = "cam", FrigateCameraName = "cam", DisplayName = "cam", Host = "192.0.2.1" };
        var binding = new CameraCapabilityBinding { CameraId = "cam", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.V380 };

        // Act
        var proof = await MakeProvider().ProveAsync(camera, binding);

        // Assert
        Assert.Equal(ProofOutcome.Unprovable, proof.Outcome);
    }

    [Fact]
    public async Task MoveForAsync_ShouldRaiseThatTheCameraIsUnreachable_WhenThePacketCannotBeSent()
    {
        // Arrange
        var camera = new Camera { Id = "cam", Slug = "cam", FrigateCameraName = "cam", DisplayName = "cam", Host = "127.0.0.1" };
        camera.EnsureProtocol(SupportedProtocol.V380).DeviceId = 87654321;
        var binding = new CameraCapabilityBinding
        {
            CameraId = "cam",
            Capability = CameraCapability.Ptz,
            Protocol = SupportedProtocol.V380,
        };

        await using var motion = await MakeProvider().OpenMotionAsync(camera, binding);

        // Act
        var error = await Assert.ThrowsAsync<CameraUnreachableException>(() => motion.MoveForAsync(PtzDirection.Right, 50, TimeSpan.FromMilliseconds(100)));

        // Assert
        Assert.Contains("127.0.0.1", error.Message, StringComparison.Ordinal);
    }
}
