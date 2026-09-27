using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

internal static class PtzBinding
{
    public static CameraCapabilityBinding With(string? configJson) => new()
    {
        CameraId = "cam1",
        Capability = CameraCapability.Ptz,
        Protocol = SupportedProtocol.Onvif,
        Verified = true,
        ConfigJson = configJson,
    };
}

public class PtzStartMoveUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly IPtzCapabilityProvider _provider = Substitute.For<IPtzCapabilityProvider>();
    private readonly IPtzMotion _motion = Substitute.For<IPtzMotion>();
    private readonly PtzManagedPositions _positions = new(new FakeTimeProvider(), NullLogger<PtzManagedPositions>.Instance);
    private readonly Camera _camera = new() { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "192.168.1.10" };

    public PtzStartMoveUseCaseTests()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(_camera);
        _registry.ResolvePtz(SupportedProtocol.Onvif).Returns(_provider);
        _provider.OpenMotionAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(_motion);
        _motion.StartAsync(Arg.Any<PtzDirection>(), Arg.Any<int>(), Arg.Any<Task>(), Arg.Any<CancellationToken>()).Returns(true);
    }

    [Theory]
    [InlineData("Left", PtzDirection.Right)]
    [InlineData("Right", PtzDirection.Left)]
    [InlineData("UpLeft", PtzDirection.UpRight)]
    [InlineData("UpRight", PtzDirection.UpLeft)]
    [InlineData("DownLeft", PtzDirection.DownRight)]
    [InlineData("DownRight", PtzDirection.DownLeft)]
    [InlineData("Up", PtzDirection.Up)]
    [InlineData("Down", PtzDirection.Down)]
    public async Task ExecuteAsync_ShouldSwapLeftAndRight_WhenTheCameraIsSetToTurnTheOtherWay(string pressed, PtzDirection sent)
    {
        // Arrange
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(PtzBinding.With("""{"pan_inverted":true}"""));

        // Act
        var found = await new PtzStartMoveUseCase(_cameras, _bindings, _registry, _positions).ExecuteAsync("cam1", new PtzMoveRequest(pressed));

        // Assert
        Assert.True(found);
        await _motion.Received(1).StartAsync(sent, 50, Arg.Any<Task>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("""{"pan_inverted":false}""")]
    [InlineData("not json")]
    public async Task ExecuteAsync_ShouldSendTheDirectionPressed_WhenTheCameraIsNotSetToTurnTheOtherWay(string? configJson)
    {
        // Arrange
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(PtzBinding.With(configJson));

        // Act
        await new PtzStartMoveUseCase(_cameras, _bindings, _registry, _positions).ExecuteAsync("cam1", new PtzMoveRequest("Left"));

        // Assert
        await _motion.Received(1).StartAsync(PtzDirection.Left, 50, Arg.Any<Task>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldStartNoMove_WhenThePtzOfTheCameraIsNotVerified()
    {
        // Arrange
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns((CameraCapabilityBinding?)null);

        // Act
        var found = await new PtzStartMoveUseCase(_cameras, _bindings, _registry, _positions).ExecuteAsync("cam1", new PtzMoveRequest("Left"));

        // Assert
        Assert.False(found);
        await _provider.DidNotReceive().OpenMotionAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldStopTheHeldMove_WhenThePressIsReleased()
    {
        // Arrange
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(PtzBinding.With(null));
        await new PtzStartMoveUseCase(_cameras, _bindings, _registry, _positions).ExecuteAsync("cam1", new PtzMoveRequest("Up"));

        // Act
        await new PtzStopMoveUseCase(_positions).ExecuteAsync("cam1");

        // Assert
        await _motion.Received(1).StoppedAsync();
        Assert.False(new PtzSignalMoveUseCase(_positions).Execute("cam1"));
    }
}
