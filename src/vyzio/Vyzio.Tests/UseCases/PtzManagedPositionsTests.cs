using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class PtzManagedPositionsTests
{
    private readonly IPtzCapabilityProvider _provider = Substitute.For<IPtzCapabilityProvider>();
    private readonly PtzManagedPositions _sut = new(NullLogger<PtzManagedPositions>.Instance);
    private readonly Camera _camera = new() { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "192.168.1.10" };
    private readonly CameraCapabilityBinding _binding = new()
    {
        CameraId = "cam1",
        Capability = CameraCapability.Ptz,
        Protocol = SupportedProtocol.Dvrip,
        Verified = true,
    };

    public PtzManagedPositionsTests()
    {
        _provider.FullRangeSteps.Returns(10);
        _provider.PtzStepAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<PtzDirection>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(true);
    }

    private Task Step(PtzDirection direction) => _sut.StepAsync(_camera, _binding, _provider, direction, 50, CancellationToken.None);

    private Task Home() => _sut.HomeAsync(_camera, _binding, _provider, CancellationToken.None);

    private Task StepsReceived(int count, PtzDirection direction)
        => _provider.Received(count).PtzStepAsync(_camera, _binding, direction, Arg.Any<int>(), Arg.Any<CancellationToken>());

    [Fact]
    public async Task HomeAsync_ShouldStepUpLeftAcrossTheWholeRangeAndSetTheOrigin_WhenThePositionIsUnknown()
    {
        // Arrange

        // Act
        await Home();

        // Assert
        await StepsReceived(10, PtzDirection.UpLeft);
        Assert.Equal((0, 0), _sut.Current("cam1"));
    }

    [Fact]
    public async Task HomeAsync_ShouldStepBackOnlyAsFarAsTheKnownPositionPlusAMargin_WhenThePositionIsKnown()
    {
        // Arrange
        await Home();
        await Step(PtzDirection.Right);
        await Step(PtzDirection.Right);
        await Step(PtzDirection.Right);
        _provider.ClearReceivedCalls();

        // Act
        await Home();

        // Assert
        await StepsReceived(5, PtzDirection.UpLeft);
        Assert.Equal((0, 0), _sut.Current("cam1"));
    }

    [Fact]
    public async Task HomeAsync_ShouldRaiseTheCamerasErrorAndKeepThePositionUnknown_WhenTheFirstStepFails()
    {
        // Arrange
        _provider.PtzStepAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<PtzDirection>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new CameraUnreachableException("DVRIP PTZ DirectionLeftUp on 192.168.1.10: connection refused"));

        // Act
        var error = await Assert.ThrowsAsync<CameraUnreachableException>(Home);

        // Assert
        Assert.Contains("connection refused", error.Message, StringComparison.Ordinal);
        await StepsReceived(1, PtzDirection.UpLeft);
        Assert.Null(_sut.Current("cam1"));
    }

    [Fact]
    public async Task HomeAsync_ShouldRefuseAtOnceAndKeepThePositionUnknown_WhenMoreStepsAreSkippedThanTheMarginCovers()
    {
        // Arrange
        _provider.PtzStepAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<PtzDirection>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(false);

        // Act
        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(Home);

        // Assert
        Assert.Contains("took 0 of the 10 steps", error.Message, StringComparison.Ordinal);
        await StepsReceived(3, PtzDirection.UpLeft);
        Assert.Null(_sut.Current("cam1"));
    }

    [Fact]
    public async Task HomeAsync_ShouldStillSetTheOrigin_WhenAStepIsLostAfterOthersWentThrough()
    {
        // Arrange
        _provider.PtzStepAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<PtzDirection>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(true), Task.FromException<bool>(new CameraUnreachableException("lost")), Task.FromResult(true));

        // Act
        await Home();

        // Assert
        await StepsReceived(10, PtzDirection.UpLeft);
        Assert.Equal((0, 0), _sut.Current("cam1"));
    }

    [Fact]
    public async Task HomeAsync_ShouldRaiseAndKeepThePositionUnknown_WhenMoreStepsAreLostThanTheMarginCovers()
    {
        // Arrange
        var lost = Task.FromException<bool>(new CameraUnreachableException("lost"));
        _provider.PtzStepAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<PtzDirection>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(true), lost, lost, lost);

        // Act
        await Assert.ThrowsAsync<CameraUnreachableException>(Home);

        // Assert
        await StepsReceived(4, PtzDirection.UpLeft);
        Assert.Null(_sut.Current("cam1"));
    }

    [Fact]
    public async Task StepAsync_ShouldCountEachStepTheCameraTook_WhenThePositionIsKnown()
    {
        // Arrange
        await Home();

        // Act
        await Step(PtzDirection.Right);
        await Step(PtzDirection.DownRight);
        await Step(PtzDirection.Down);

        // Assert
        Assert.Equal((2, 2), _sut.Current("cam1"));
    }

    [Fact]
    public async Task StepAsync_ShouldNotCountTheStep_WhenTheCameraDidNotTakeIt()
    {
        // Arrange
        await Home();
        _provider.PtzStepAsync(_camera, _binding, PtzDirection.Right, Arg.Any<int>(), Arg.Any<CancellationToken>()).Returns(false);

        // Act
        await Step(PtzDirection.Right);

        // Assert
        Assert.Equal((0, 0), _sut.Current("cam1"));
    }

    [Fact]
    public async Task StepAsync_ShouldMoveWithoutInventingAPosition_WhenTheCameraWasNeverHomed()
    {
        // Arrange

        // Act
        await Step(PtzDirection.Right);

        // Assert
        await StepsReceived(1, PtzDirection.Right);
        Assert.Null(_sut.Current("cam1"));
    }

    [Fact]
    public async Task GoToAsync_ShouldStepFromTheCurrentPositionToTheTarget_WhenThePositionIsKnown()
    {
        // Arrange
        await Home();
        await Step(PtzDirection.Right);
        await Step(PtzDirection.Right);
        await Step(PtzDirection.Right);
        await Step(PtzDirection.Down);
        _provider.ClearReceivedCalls();

        // Act
        await _sut.GoToAsync(_camera, _binding, _provider, targetX: 1, targetY: 3, CancellationToken.None);

        // Assert
        await StepsReceived(0, PtzDirection.UpLeft);
        await StepsReceived(2, PtzDirection.Left);
        await StepsReceived(2, PtzDirection.Down);
        Assert.Equal((1, 3), _sut.Current("cam1"));
    }

    [Fact]
    public async Task GoToAsync_ShouldRaiseAndKeepCountingOnlyTheStepsTaken_WhenAStepIsSkipped()
    {
        // Arrange
        await Home();
        _provider.PtzStepAsync(_camera, _binding, PtzDirection.Right, Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(true, false, true);

        // Act
        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(
            () => _sut.GoToAsync(_camera, _binding, _provider, targetX: 3, targetY: 0, CancellationToken.None));

        // Assert
        Assert.Contains("stopped 1 steps short", error.Message, StringComparison.Ordinal);
        Assert.Equal((2, 0), _sut.Current("cam1"));
    }

    [Fact]
    public async Task GoToAsync_ShouldHomeThenReplayTheTarget_WhenThePositionIsUnknown()
    {
        // Arrange

        // Act
        await _sut.GoToAsync(_camera, _binding, _provider, targetX: 4, targetY: 2, CancellationToken.None);

        // Assert
        await StepsReceived(10, PtzDirection.UpLeft);
        await StepsReceived(4, PtzDirection.Right);
        await StepsReceived(2, PtzDirection.Down);
        Assert.Equal((4, 2), _sut.Current("cam1"));
    }
}
