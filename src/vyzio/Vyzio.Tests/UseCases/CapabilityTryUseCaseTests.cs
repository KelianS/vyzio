using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class TryCameraCapabilityUseCaseTests
{
    private readonly FakeTimeProvider _time = new();
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly IPtzCapabilityProvider _ptz = Substitute.For<IPtzCapabilityProvider>();
    private readonly IPtzMotion _motion = Substitute.For<IPtzMotion>();
    private readonly IPrivacyCapabilityProvider _cut = Substitute.For<IPrivacyCapabilityProvider>();
    private readonly Camera _camera = new() { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "192.168.1.10" };
    private readonly TryCameraCapabilityUseCase _sut;

    public TryCameraCapabilityUseCaseTests()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(_camera);
        _registry.ResolvePtz(Arg.Any<SupportedProtocol>()).Returns(_ptz);
        _registry.ResolvePrivacy(Arg.Any<SupportedProtocol>()).Returns(_cut);
        _ptz.OpenMotionAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(_motion);
        _sut = new(_cameras, _bindings, _registry, new PtzManagedPositions(_time, NullLogger<PtzManagedPositions>.Instance), _time);
    }

    private void BindingIs(CameraCapability capability, CapabilityStatus status)
        => _bindings.GetAsync("cam1", capability, Arg.Any<CancellationToken>()).Returns(new CameraCapabilityBinding
        {
            CameraId = "cam1",
            Capability = capability,
            Protocol = SupportedProtocol.TapoKlap,
            Status = status,
        });

    [Fact]
    public async Task ExecuteAsync_ShouldTurnTheHeadBothWaysAndBringItBack_WhenPtzIsToConfirm()
    {
        // Arrange
        BindingIs(CameraCapability.Ptz, CapabilityStatus.ToConfirm);

        // Act
        var outcome = await _sut.ExecuteAsync("cam1", CameraCapability.Ptz);

        // Assert
        Assert.Equal(CapabilityTryOutcome.Done, outcome);
        await _motion.Received(1).MoveForAsync(PtzDirection.Right, Arg.Any<int>(), CapabilityTry.PtzNudge, Arg.Any<CancellationToken>());
        await _motion.Received(1).MoveForAsync(PtzDirection.Left, Arg.Any<int>(), CapabilityTry.PtzNudge, Arg.Any<CancellationToken>());
        await _motion.Received(1).MoveForAsync(PtzDirection.Down, Arg.Any<int>(), CapabilityTry.PtzNudge, Arg.Any<CancellationToken>());
        await _motion.Received(1).MoveForAsync(PtzDirection.Up, Arg.Any<int>(), CapabilityTry.PtzNudge, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldCutThenOpen_WhenTheHardwareCutIsToConfirmAndTheHoldIsOver()
    {
        // Arrange
        BindingIs(CameraCapability.HardwarePrivacy, CapabilityStatus.ToConfirm);

        // Act
        var trying = _sut.ExecuteAsync("cam1", CameraCapability.HardwarePrivacy);
        _time.Advance(CapabilityTry.CutHold);
        var outcome = await trying;

        // Assert
        Assert.Equal(CapabilityTryOutcome.Done, outcome);
        Received.InOrder(() =>
        {
            _cut.SetPrivacyModeAsync(_camera, Arg.Any<CameraCapabilityBinding>(), true, Arg.Any<CancellationToken>());
            _cut.SetPrivacyModeAsync(_camera, Arg.Any<CameraCapabilityBinding>(), false, Arg.Any<CancellationToken>());
        });
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepTheCameraCut_WhenTheHoldIsNotOverYet()
    {
        // Arrange
        BindingIs(CameraCapability.HardwarePrivacy, CapabilityStatus.ToConfirm);

        // Act
        _ = _sut.ExecuteAsync("cam1", CameraCapability.HardwarePrivacy);
        _time.Advance(CapabilityTry.CutHold - TimeSpan.FromMilliseconds(1));

        // Assert
        await _cut.Received(1).SetPrivacyModeAsync(_camera, Arg.Any<CameraCapabilityBinding>(), true, Arg.Any<CancellationToken>());
        await _cut.DidNotReceive().SetPrivacyModeAsync(_camera, Arg.Any<CameraCapabilityBinding>(), false, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldOpenTheCutAnyway_WhenTheTryIsCancelledDuringTheHold()
    {
        // Arrange
        BindingIs(CameraCapability.HardwarePrivacy, CapabilityStatus.ToConfirm);
        using var cts = new CancellationTokenSource();

        // Act
        var trying = _sut.ExecuteAsync("cam1", CameraCapability.HardwarePrivacy, cts.Token);
        await cts.CancelAsync();

        // Assert
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => trying);
        await _cut.Received(1).SetPrivacyModeAsync(_camera, Arg.Any<CameraCapabilityBinding>(), false, CancellationToken.None);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRefuseWithoutMovingTheCamera_WhenThePrivacyModeIsOn()
    {
        // Arrange
        _camera.PrivacyModeActive = true;
        BindingIs(CameraCapability.Ptz, CapabilityStatus.ToConfirm);

        // Act
        var outcome = await _sut.ExecuteAsync("cam1", CameraCapability.Ptz);

        // Assert
        Assert.Equal(CapabilityTryOutcome.PrivacyModeActive, outcome);
        await _ptz.DidNotReceive().OpenMotionAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRefuse_WhenTheCapabilityIsNotToConfirm()
    {
        // Arrange
        BindingIs(CameraCapability.Ptz, CapabilityStatus.Verified);

        // Act
        var outcome = await _sut.ExecuteAsync("cam1", CameraCapability.Ptz);

        // Assert
        Assert.Equal(CapabilityTryOutcome.NothingToConfirm, outcome);
        await _ptz.DidNotReceive().OpenMotionAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRecordNothing_WhenTheTryIsDone()
    {
        // Arrange
        BindingIs(CameraCapability.Ptz, CapabilityStatus.ToConfirm);

        // Act
        await _sut.ExecuteAsync("cam1", CameraCapability.Ptz);

        // Assert
        await _bindings.DidNotReceive().SaveAsync(Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }
}

public class ConfirmCameraCapabilityUseCaseTests
{
    private readonly FakeTimeProvider _time = new(new DateTimeOffset(2026, 10, 4, 9, 30, 0, TimeSpan.Zero));
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly Camera _camera = new() { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "192.168.1.10" };
    private readonly ConfirmCameraCapabilityUseCase _sut;

    public ConfirmCameraCapabilityUseCaseTests()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(_camera);
        _sut = new(_cameras, _bindings, _time);
    }

    private CameraCapabilityBinding BindingIs(CapabilityStatus status)
    {
        var binding = new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.V380, Status = status };
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(binding);
        return binding;
    }

    [Fact]
    public async Task ExecuteAsync_ShouldVerifyItConfirmedByTheUserAndShowThePtzPanel_WhenTheUserAnswersYes()
    {
        // Arrange
        var binding = BindingIs(CapabilityStatus.ToConfirm);

        // Act
        var result = await _sut.ExecuteAsync("cam1", CameraCapability.Ptz, worked: true);

        // Assert
        Assert.Equal(CapabilityAnswerOutcome.Recorded, result.Outcome);
        Assert.Equal(CapabilityStatus.Verified, binding.Status);
        Assert.Equal(_time.GetUtcNow(), binding.ConfirmedAt);
        Assert.True(_camera.PtzSupported);
        await _bindings.Received(1).SaveAsync(binding, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRejectItWithoutAConfirmation_WhenTheUserAnswersNo()
    {
        // Arrange
        var binding = BindingIs(CapabilityStatus.ToConfirm);

        // Act
        var result = await _sut.ExecuteAsync("cam1", CameraCapability.Ptz, worked: false);

        // Assert
        Assert.Equal(CapabilityStatus.RejectedByUser, binding.Status);
        Assert.Null(binding.ConfirmedAt);
        Assert.False(result.Binding!.Verified);
        Assert.False(_camera.PtzSupported);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRefuseTheAnswer_WhenTheCapabilityIsNotToConfirm()
    {
        // Arrange
        var binding = BindingIs(CapabilityStatus.Missing);

        // Act
        var result = await _sut.ExecuteAsync("cam1", CameraCapability.Ptz, worked: true);

        // Assert
        Assert.Equal(CapabilityAnswerOutcome.NothingToConfirm, result.Outcome);
        Assert.Equal(CapabilityStatus.Missing, binding.Status);
        await _bindings.DidNotReceive().SaveAsync(Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }
}
